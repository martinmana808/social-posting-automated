import { describe, it, expect, vi, afterEach } from 'vitest';
import { postImageUrls, publishPost, accountFor, type ClientRow } from './run';
import type { Post } from '../../types';

// A minimal Supabase stand-in: records every .update() payload, resolves all
// awaited query chains to an empty result. Enough to drive publishPost.
function fakeDb() {
	const updates: Record<string, unknown>[] = [];
	const builder: any = {
		from: () => builder,
		select: () => builder,
		update: (obj: Record<string, unknown>) => {
			updates.push(obj);
			return builder;
		},
		eq: () => builder,
		then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
	};
	builder.updates = updates;
	return builder;
}

const basePost = (over: Partial<Post> = {}): Post =>
	({
		id: 'p1',
		client_id: 'c1',
		scheduled_at: '2026-06-13T06:00:00.000Z',
		image_url: 'https://x/1.png',
		title: '',
		blurb: '',
		hashtags: '',
		caption: 'hi',
		status: 'publishing',
		attempts: 0,
		last_error: null,
		fb_post_id: null,
		ig_post_id: null,
		published_at: null,
		created_at: '2026-06-13T00:00:00.000Z',
		...over
	}) as Post;

const account = { pageId: 'PAGE', pageToken: 'tok', igUserId: 'IGU' };

// Mock the Graph API by URL.
function mockFetch() {
	return vi.fn(async (url: any) => {
		const u = String(url);
		const body = u.endsWith('/media_publish')
			? { id: 'IG1' }
			: u.includes('/media')
				? { id: 'C1' }
				: u.includes('/photos')
					? { id: 'ph', post_id: 'FB1' }
					: {};
		return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
	});
}

afterEach(() => vi.unstubAllGlobals());

describe('postImageUrls', () => {
	it('splits the pipe list', () => {
		expect(postImageUrls(basePost({ image_url: 'a|b|c' }))).toEqual(['a', 'b', 'c']);
	});
});

describe('accountFor', () => {
	const client = (over: Partial<ClientRow> = {}): ClientRow => ({
		id: 'c1',
		status: 'active',
		fb_page_id: 'PAGE',
		fb_page_token: 'ENC',
		ig_user_id: 'IGU',
		...over
	});
	const decrypt = (c: string) => `dec(${c})`;

	it('builds an account with the decrypted token', () => {
		expect(accountFor(client(), decrypt)).toEqual({
			pageId: 'PAGE',
			pageToken: 'dec(ENC)',
			igUserId: 'IGU'
		});
	});

	it('returns null when the client has no page or token (not connected)', () => {
		expect(accountFor(client({ fb_page_token: null }), decrypt)).toBeNull();
		expect(accountFor(client({ fb_page_id: null }), decrypt)).toBeNull();
	});

	it('defaults igUserId to empty string (Facebook-only)', () => {
		expect(accountFor(client({ ig_user_id: null }), decrypt)?.igUserId).toBe('');
	});
});

describe('publishPost', () => {
	it('publishes FB + IG, persists both ids, marks published', async () => {
		const f = mockFetch();
		vi.stubGlobal('fetch', f);
		const db = fakeDb();
		await publishPost(basePost(), db, account);
		const calls = f.mock.calls.map((c) => String(c[0]));
		expect(calls.some((u) => u.includes('/photos'))).toBe(true); // FB ran
		expect(calls.some((u) => u.includes('/media'))).toBe(true); // IG ran
		expect(db.updates).toContainEqual({ fb_post_id: 'FB1' });
		expect(db.updates).toContainEqual({ ig_post_id: 'IG1' });
		expect(db.updates.at(-1)).toMatchObject({ status: 'published' });
	});

	it('skips Facebook when fb_post_id already exists (retry idempotency)', async () => {
		const f = mockFetch();
		vi.stubGlobal('fetch', f);
		await publishPost(basePost({ fb_post_id: 'ALREADY' }), fakeDb(), account);
		const calls = f.mock.calls.map((c) => String(c[0]));
		expect(calls.some((u) => u.includes('/photos'))).toBe(false);
		expect(calls.some((u) => u.includes('/media'))).toBe(true);
	});

	it('recovers an already-live IG post on retry instead of publishing a duplicate', async () => {
		const f = vi.fn(async (url: any, init?: any) => {
			const u = String(url);
			const method = init?.method ?? 'GET';
			if (method === 'GET' && u.includes('/IGU/media')) {
				return new Response(JSON.stringify({ data: [{ id: 'LIVE1', caption: 'hi' }] }), {
					headers: { 'content-type': 'application/json' }
				});
			}
			return new Response(JSON.stringify({ id: 'NEW' }), {
				headers: { 'content-type': 'application/json' }
			});
		});
		vi.stubGlobal('fetch', f);
		const db = fakeDb();
		await publishPost(basePost({ fb_post_id: 'ALREADY', attempts: 2 }), db, account);
		const posts = f.mock.calls.filter((c) => (c[1] as any)?.method === 'POST').map((c) => String(c[0]));
		expect(posts.some((u) => u.includes('/media'))).toBe(false); // nothing republished
		expect(db.updates).toContainEqual({ ig_post_id: 'LIVE1' });
		expect(db.updates.at(-1)).toMatchObject({ status: 'published' });
	});

	it('publishes Facebook only when no IG account is configured', async () => {
		const f = mockFetch();
		vi.stubGlobal('fetch', f);
		const db = fakeDb();
		await publishPost(basePost(), db, { ...account, igUserId: '' });
		const calls = f.mock.calls.map((c) => String(c[0]));
		expect(calls.some((u) => u.includes('/photos'))).toBe(true);
		expect(calls.some((u) => u.includes('/media'))).toBe(false);
		expect(db.updates.at(-1)).toMatchObject({ status: 'published' });
	});
});
