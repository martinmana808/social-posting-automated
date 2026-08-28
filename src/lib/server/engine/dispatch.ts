// Bridges SvelteKit (the dashboard + /api/cron) to the publish engine.
//
// In prod, publishing must run in the Netlify *background* function (15-min
// budget) because IG carousels exceed the 10s synchronous limit. In dev there is
// no function timeout, so we just run the engine inline. Either way the caller
// returns immediately and the post's status reflects progress.
import { dev } from '$app/environment';
import { supabase } from '../supabase';
import { config } from '../config';
import { decryptToken } from '../crypto';
import { runAllDue, publishSingle, type Deps } from './run';

const BACKGROUND_FN = '/.netlify/functions/publish-due-background';

function deps(): Deps {
	return { db: supabase(), decrypt: decryptToken };
}

export type DispatchMode = 'inline' | 'background';

/**
 * Kick off publishing. `postId` set → publish that one now (ignoring schedule);
 * omitted → publish everything due across all active clients. Returns how it was
 * dispatched.
 */
export async function dispatchPublish(origin: string, postId?: string): Promise<DispatchMode> {
	if (dev) {
		if (postId) await publishSingle(postId, deps());
		else await runAllDue(deps());
		return 'inline';
	}
	// Fire the background function and return — it runs up to 15 minutes.
	await fetch(`${origin}${BACKGROUND_FN}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-cron-secret': config.security.cronSecret() },
		body: JSON.stringify(postId ? { postId } : {})
	});
	return 'background';
}
