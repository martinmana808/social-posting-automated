import { fail } from '@sveltejs/kit';
import {
	listClients,
	createClient,
	updateClient,
	deleteClient,
	setClientCredentials
} from '$lib/server/clients';
import type { Actions, PageServerLoad } from './$types';

/** ~60-day default expiry for a freshly minted long-lived Page token. */
function defaultExpiry(): string {
	return new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
}

/** Make a URL-safe id from a name. */
function slugify(s: string): string {
	return (
		s
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'client'
	);
}

/** A slug not already taken (appends -2, -3, … if needed). */
async function uniqueSlug(base: string): Promise<string> {
	const taken = new Set((await listClients()).map((c) => c.slug));
	if (!taken.has(base)) return base;
	for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export const load: PageServerLoad = async () => {
	return { clients: await listClients() };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const f = await request.formData();
		const name = String(f.get('name') ?? '').trim();
		const timezone = String(f.get('timezone') ?? '').trim() || 'Pacific/Auckland';
		if (!name) return fail(400, { error: 'Client name is required.' });
		// The slug is an internal id — generated from the name, no need to ask.
		const slug = await uniqueSlug(slugify(name));
		const res = await createClient({ name, slug, timezone });
		if ('error' in res) return fail(400, { error: res.error });
		return { created: true };
	},

	updateInfo: async ({ request }) => {
		const f = await request.formData();
		const id = String(f.get('id'));
		const name = String(f.get('name') ?? '').trim();
		const timezone = String(f.get('timezone') ?? '').trim();
		if (!name || !timezone) return fail(400, { error: 'Name and timezone are required.' });
		await updateClient(id, { name, timezone });
		return { updated: true };
	},

	setStatus: async ({ request }) => {
		const f = await request.formData();
		const id = String(f.get('id'));
		const status = String(f.get('status'));
		if (status !== 'active' && status !== 'paused') return fail(400, { error: 'Bad status.' });
		await updateClient(id, { status });
		return { updated: true };
	},

	setCreds: async ({ request }) => {
		const f = await request.formData();
		const id = String(f.get('id'));
		const fb_page_id = String(f.get('fb_page_id') ?? '').trim();
		const fb_page_token = String(f.get('fb_page_token') ?? '').trim();
		if (!fb_page_id || !fb_page_token) {
			return fail(400, { error: 'Facebook Page ID and token are both required.' });
		}
		await setClientCredentials(id, {
			fb_page_id,
			fb_page_name: String(f.get('fb_page_name') ?? '').trim() || undefined,
			fb_page_token,
			ig_user_id: String(f.get('ig_user_id') ?? '').trim() || undefined,
			ig_username: String(f.get('ig_username') ?? '').trim() || undefined,
			token_expires_at: defaultExpiry()
		});
		return { credsSet: true };
	},

	remove: async ({ request }) => {
		const f = await request.formData();
		await deleteClient(String(f.get('id')));
		return { removed: true };
	}
};
