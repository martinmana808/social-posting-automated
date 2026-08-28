// Internal cron endpoint for manual "post anything due now":
//   curl -X POST $URL/api/cron -H "x-cron-secret: $CRON_SECRET"
// The scheduled Netlify function triggers the background function directly, so
// this endpoint just hands off to the same dispatcher.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { dispatchPublish } from '$lib/server/engine/dispatch';
import { config } from '$lib/server/config';

export const POST: RequestHandler = async ({ request, url }) => {
	if (request.headers.get('x-cron-secret') !== config.security.cronSecret()) {
		throw error(401, 'Unauthorized');
	}
	const mode = await dispatchPublish(url.origin);
	return json({ ok: true, mode });
};
