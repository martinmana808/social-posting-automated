import { redirect, type RequestHandler } from '@sveltejs/kit';
import { ADMIN_COOKIE } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete(ADMIN_COOKIE, { path: '/' });
	throw redirect(303, '/login');
};
