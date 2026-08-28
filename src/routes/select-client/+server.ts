// Sets the operator's currently-selected client (cookie), then returns to the
// dashboard. Posted by the top-bar switcher.
import { redirect, type RequestHandler } from '@sveltejs/kit';
import { SELECTED_COOKIE } from '$lib/server/selected';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const form = await request.formData();
	const id = String(form.get('id') ?? '');
	if (id) {
		cookies.set(SELECTED_COOKIE, id, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
	}
	throw redirect(303, '/');
};
