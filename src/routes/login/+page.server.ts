import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { ADMIN_COOKIE, adminCookieValue, verifyPassword } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.isAdmin) throw redirect(303, url.searchParams.get('next') || '/');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		if (!verifyPassword(String(form.get('password') ?? ''))) {
			return fail(401, { error: 'Incorrect password.' });
		}
		cookies.set(ADMIN_COOKIE, adminCookieValue(), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			// Secure cookies aren't stored over http://localhost — prod only.
			secure: !dev,
			maxAge: 60 * 60 * 24 * 30
		});
		throw redirect(303, url.searchParams.get('next') || '/');
	}
};
