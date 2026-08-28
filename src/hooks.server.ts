import { redirect, type Handle } from '@sveltejs/kit';
import { ADMIN_COOKIE, verifyCookie } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.isAdmin = verifyCookie(event.cookies.get(ADMIN_COOKIE));
	// Everything except /login and /api is admin-only.
	const p = event.url.pathname;
	const isProtected = p === '/' || p.startsWith('/admin');
	if (isProtected && !event.locals.isAdmin) {
		throw redirect(303, `/login?next=${encodeURIComponent(p)}`);
	}
	return resolve(event);
};
