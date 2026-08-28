// Scheduled function — Netlify's cron. Every 15 min it triggers the publish
// *background* function, which has a 15-minute budget (IG carousels run ~10s per
// image, far past the 10s synchronous-function limit). This scheduled function
// itself just fires the trigger and returns; the background function does the work.
import type { Config } from '@netlify/functions';

export default async function handler() {
	const url = process.env.URL;
	const secret = process.env.CRON_SECRET;
	if (!url || !secret) {
		console.error('[publish-due] Missing URL or CRON_SECRET');
		return new Response('misconfigured', { status: 500 });
	}
	const res = await fetch(`${url}/.netlify/functions/publish-due-background`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-cron-secret': secret },
		body: '{}'
	});
	console.log(`[publish-due] triggered background fn -> ${res.status}`);
	return new Response(`triggered ${res.status}`, { status: 200 });
}

export const config: Config = { schedule: '*/15 * * * *' };
