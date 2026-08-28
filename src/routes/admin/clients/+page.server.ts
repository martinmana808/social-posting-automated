import { fail } from '@sveltejs/kit';
import {
	listClients,
	createClient,
	updateClient,
	deleteClient,
	setClientCredentials
} from '$lib/server/clients';
import type { Actions, PageServerLoad } from './$types';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** ~60-day default expiry for a freshly minted long-lived Page token. */
function defaultExpiry(): string {
	return new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
}

export const load: PageServerLoad = async () => {
	return { clients: await listClients() };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const f = await request.formData();
		const name = String(f.get('name') ?? '').trim();
		const slug = String(f.get('slug') ?? '')
			.trim()
			.toLowerCase();
		const timezone = String(f.get('timezone') ?? '').trim() || 'Pacific/Auckland';
		if (!name) return fail(400, { error: 'Client name is required.' });
		if (!SLUG_RE.test(slug)) {
			return fail(400, { error: 'Slug must be lowercase letters, numbers and hyphens.' });
		}
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
