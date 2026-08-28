// Minimal shared-password admin session.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config';

export const ADMIN_COOKIE = 'spa_admin';

export function adminCookieValue(): string {
	return createHmac('sha256', config.security.cronSecret())
		.update(`admin:${config.security.adminPassword()}`)
		.digest('hex');
}

function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const verifyPassword = (password: string) => safeEqual(password, config.security.adminPassword());
export const verifyCookie = (value: string | undefined) =>
	value !== undefined && safeEqual(value, adminCookieValue());
