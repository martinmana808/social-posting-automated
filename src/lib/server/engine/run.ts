// The publish engine — env-agnostic and dependency-injected so it runs both
// inside SvelteKit (dev) and inside a Netlify background function (prod, 15-min
// budget). The caller supplies the Supabase client and a `decrypt` function
// (which needs the encryption key — kept out of this module so it stays testable
// and env-agnostic).
//
// Multi-client: `runAllDue` loops over active, connected clients and publishes
// each client's due posts using THAT client's account. Everything is scoped by
// client_id, so clients never cross.
//
// For each due post it publishes to BOTH Facebook and Instagram. Each platform's
// remote id is persisted the moment it succeeds, so a retry only redoes the
// missing platform — a post is never duplicated.
import type { SupabaseClient } from '@supabase/supabase-js';
import { GraphError } from '../meta/client';
import { publishFacebook } from '../meta/facebook';
import { findPublishedByCaption, publishInstagram } from '../meta/instagram';
import type { Post } from '../../types';

export interface Account {
	pageId: string;
	pageToken: string;
	igUserId: string; // '' when no IG account is linked → Facebook only
}

/** Minimal client shape the engine needs (a row from the `clients` table). */
export interface ClientRow {
	id: string;
	status: string;
	fb_page_id: string | null;
	fb_page_token: string | null;
	ig_user_id: string | null;
}

export type Decrypt = (cipher: string) => string;

export interface Deps {
	db: SupabaseClient;
	decrypt: Decrypt;
}

export interface RunSummary {
	claimed: number;
	published: number;
	failed: number;
}

export const MAX_ATTEMPTS = 4;
const BATCH_SIZE = 25;

/** A post's image_url holds one or more public URLs, pipe-separated (carousel). */
export function postImageUrls(post: Post): string[] {
	return post.image_url
		.split('|')
		.map((u) => u.trim())
		.filter(Boolean);
}

/** Build an Account from a client row, or null if the client isn't connected. */
export function accountFor(client: ClientRow, decrypt: Decrypt): Account | null {
	if (!client.fb_page_id || !client.fb_page_token) return null;
	return {
		pageId: client.fb_page_id,
		pageToken: decrypt(client.fb_page_token),
		igUserId: client.ig_user_id ?? ''
	};
}

/** Publish every active client's due posts. Returns a per-client summary. */
export async function runAllDue(
	{ db, decrypt }: Deps,
	now: Date = new Date()
): Promise<Record<string, RunSummary>> {
	const { data: clients, error } = await db.from('clients').select('*').eq('status', 'active');
	if (error) throw error;

	const results: Record<string, RunSummary> = {};
	for (const client of (clients ?? []) as ClientRow[]) {
		const account = accountFor(client, decrypt);
		if (!account) continue; // not connected yet — skip
		results[client.id] = await runClientDue(db, client.id, account, now);
	}
	return results;
}

/** Publish one client's pending posts whose scheduled time has passed. */
export async function runClientDue(
	db: SupabaseClient,
	clientId: string,
	account: Account,
	now: Date = new Date()
): Promise<RunSummary> {
	const summary: RunSummary = { claimed: 0, published: 0, failed: 0 };

	const { data: due, error } = await db
		.from('posts')
		.select('*')
		.eq('client_id', clientId)
		.eq('status', 'pending')
		.lte('scheduled_at', now.toISOString())
		.order('scheduled_at', { ascending: true })
		.limit(BATCH_SIZE);
	if (error) throw error;

	for (const post of (due ?? []) as Post[]) {
		if (!(await claim(db, post.id))) continue; // lost the race to another run
		summary.claimed++;
		try {
			await publishPost(post, db, account);
			summary.published++;
		} catch (err) {
			await handleFailure(db, post, err);
			summary.failed++;
		}
	}
	return summary;
}

/**
 * Force-publish one post immediately, ignoring its schedule (the dashboard
 * "Publish now" button). Resolves the post's client, decrypts its token, and
 * publishes. Skips posts that are already published.
 */
export async function publishSingle(postId: string, { db, decrypt }: Deps): Promise<void> {
	const { data } = await db.from('posts').select('*').eq('id', postId).single();
	const post = data as Post | null;
	if (!post) throw new Error('Post not found');
	if (post.status === 'published') return;

	const { data: clientData } = await db
		.from('clients')
		.select('*')
		.eq('id', post.client_id)
		.single();
	const client = clientData as ClientRow | null;
	if (!client) throw new Error('Client not found');
	const account = accountFor(client, decrypt);
	if (!account) throw new Error('Client is not connected (no Facebook Page token).');

	// Best-effort claim so the scheduler doesn't also grab it.
	await db.from('posts').update({ status: 'publishing' }).eq('id', postId);
	try {
		await publishPost(post, db, account);
	} catch (err) {
		await handleFailure(db, post, err);
		throw err;
	}
}

/**
 * Publish one post to both platforms, persisting each id as it lands so retries
 * skip the platform that already succeeded. Throws if either platform fails.
 */
export async function publishPost(post: Post, db: SupabaseClient, account: Account): Promise<void> {
	const urls = postImageUrls(post);
	if (urls.length === 0) throw new GraphError('Post has no image URL', 400);

	let fbId = post.fb_post_id;
	let igId = post.ig_post_id;

	if (!fbId) {
		fbId = await publishFacebook(account.pageId, account.pageToken, urls, post.caption);
		await db.from('posts').update({ fb_post_id: fbId }).eq('id', post.id);
	}
	// Instagram only if an IG Business account is linked + configured.
	if (account.igUserId && !igId) {
		// On a retry the previous attempt may have gone live even though Meta
		// answered with an error — recover it instead of publishing a duplicate.
		if (post.attempts > 0) {
			igId = await findPublishedByCaption(account.igUserId, account.pageToken, post.caption);
		}
		if (!igId) {
			igId = await publishInstagram(account.igUserId, account.pageToken, urls, post.caption);
		}
		await db.from('posts').update({ ig_post_id: igId }).eq('id', post.id);
	}

	await db
		.from('posts')
		.update({ status: 'published', published_at: new Date().toISOString(), last_error: null })
		.eq('id', post.id);
}

/** Atomically move pending -> publishing. Returns false if another run won. */
async function claim(db: SupabaseClient, id: string): Promise<boolean> {
	const { data } = await db
		.from('posts')
		.update({ status: 'publishing' })
		.eq('id', id)
		.eq('status', 'pending')
		.select('id');
	return (data?.length ?? 0) > 0;
}

async function handleFailure(db: SupabaseClient, post: Post, err: unknown): Promise<void> {
	const message = err instanceof Error ? err.message : String(err);
	const transient = err instanceof GraphError && err.isTransient;
	const attempts = post.attempts + 1;
	const canRetry = transient && attempts < MAX_ATTEMPTS;
	await db
		.from('posts')
		.update({ status: canRetry ? 'pending' : 'failed', attempts, last_error: message })
		.eq('id', post.id);
}
