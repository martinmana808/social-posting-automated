import { fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { parseCsv, savePosts } from '$lib/server/ingest';
import { dispatchPublish } from '$lib/server/engine/dispatch';
import { selectedClient } from '$lib/server/selected';
import { zonedToUtc } from '$lib/datetime';
import { serializeSlides } from '$lib/slides';
import type { Actions, PageServerLoad } from './$types';
import type { Post } from '$lib/types';

const EDITABLE = new Set(['draft', 'pending']);

/** Default schedule for a brand-new draft: tomorrow 09:00 in the client's zone. */
function defaultSchedule(tz: string): string {
	const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
	const p = new Intl.DateTimeFormat('en-CA', {
		timeZone: tz,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	})
		.formatToParts(tomorrow)
		.reduce<Record<string, string>>((acc, part) => {
			if (part.type !== 'literal') acc[part.type] = part.value;
			return acc;
		}, {});
	return zonedToUtc(`${p.year}-${p.month}-${p.day}T09:00:00`, tz) ?? new Date().toISOString();
}

export const load: PageServerLoad = async ({ cookies }) => {
	const client = await selectedClient(cookies);
	if (!client) return { client: null, posts: [], stats: null };

	const { data } = await supabase()
		.from('posts')
		.select('*')
		.eq('client_id', client.id)
		.order('scheduled_at', { ascending: true });
	const posts = (data ?? []) as Post[];
	return {
		client,
		posts,
		stats: {
			draft: posts.filter((p) => p.status === 'draft').length,
			pending: posts.filter((p) => p.status === 'pending').length,
			published: posts.filter((p) => p.status === 'published').length,
			failed: posts.filter((p) => p.status === 'failed').length
		}
	};
};

export const actions: Actions = {
	// Parse pasted CSV and save rows as pending posts for the selected client.
	ingest: async ({ request, cookies }) => {
		const client = await selectedClient(cookies);
		if (!client) return fail(400, { error: 'Select or create a client first.' });
		const form = await request.formData();
		const csv = String(form.get('csv') ?? '').trim();
		if (!csv) return fail(400, { error: 'Paste your CSV first.' });
		try {
			const saved = await savePosts(client.id, parseCsv(csv, client.timezone));
			return { ingested: saved };
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : 'Parse failed.' });
		}
	},

	// Publish everything due (across all active clients — the background function
	// scopes per client). In prod this hands off to the 15-min background fn.
	runDue: async ({ url }) => {
		const mode = await dispatchPublish(url.origin);
		return { dispatched: mode };
	},

	// Force-publish a single post now (ignores its schedule). Verifies the post
	// belongs to the selected client before dispatching.
	publishOne: async ({ request, url, cookies }) => {
		const client = await selectedClient(cookies);
		const form = await request.formData();
		const id = String(form.get('id'));
		const { data: post } = await supabase()
			.from('posts')
			.select('id, client_id')
			.eq('id', id)
			.single();
		if (!post || post.client_id !== client?.id) return fail(404, { error: 'Post not found.' });
		const mode = await dispatchPublish(url.origin, id);
		return { dispatchedOne: mode };
	},

	remove: async ({ request, cookies }) => {
		const client = await selectedClient(cookies);
		const form = await request.formData();
		await supabase()
			.from('posts')
			.delete()
			.eq('id', String(form.get('id')))
			.eq('client_id', client?.id ?? '');
		return { removed: true };
	},

	// Insert a blank draft the user then fills in via the inline editor.
	createDraft: async ({ cookies }) => {
		const client = await selectedClient(cookies);
		if (!client) return fail(400, { error: 'Select or create a client first.' });
		const { data, error } = await supabase()
			.from('posts')
			.insert({
				client_id: client.id,
				scheduled_at: defaultSchedule(client.timezone),
				image_url: '',
				caption: '',
				status: 'draft'
			})
			.select('id')
			.single();
		if (error) return fail(500, { error: error.message });
		return { createdId: data.id };
	},

	// Save edits (slides, caption, schedule) to a draft/pending post.
	updatePost: async ({ request, cookies }) => {
		const client = await selectedClient(cookies);
		if (!client) return fail(400, { error: 'Select a client first.' });
		const f = await request.formData();
		const id = String(f.get('id'));

		// Re-check ownership + status server-side — the UI could be stale.
		const { data: existing } = await supabase()
			.from('posts')
			.select('status, client_id')
			.eq('id', id)
			.single();
		if (!existing || existing.client_id !== client.id) {
			return fail(404, { error: 'Post not found.' });
		}
		if (!EDITABLE.has(existing.status)) {
			return fail(400, { error: 'Only draft or pending posts can be edited.' });
		}

		let urls: unknown;
		try {
			urls = JSON.parse(String(f.get('images') ?? '[]'));
		} catch {
			return fail(400, { error: 'Could not read the image list.' });
		}
		const imageUrl = serializeSlides(Array.isArray(urls) ? (urls as string[]) : []);
		if (!imageUrl) return fail(400, { error: 'Add at least one image before saving.' });

		const local = String(f.get('scheduled_local') ?? '').trim(); // "YYYY-MM-DDTHH:MM"
		const iso = local ? zonedToUtc(`${local}:00`, client.timezone) : null;
		if (!iso) return fail(400, { error: 'Pick a valid date and time.' });

		const caption = String(f.get('caption') ?? '');
		const { error } = await supabase()
			.from('posts')
			.update({ image_url: imageUrl, caption, scheduled_at: iso })
			.eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { updated: true };
	}
};
