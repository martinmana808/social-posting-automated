// Background function — Netlify gives these up to 15 minutes (vs 10s for normal
// functions). The publish engine needs it: an IG carousel takes ~10s per image
// because Instagram downloads each one server-side, so a multi-slide post runs
// well past the synchronous limit. The "-background" filename suffix is what
// makes Netlify treat this as a background function.
//
// Triggered by the scheduled function (every 15 min, no body → publish all due
// across all active clients) and by the dashboard's Publish buttons (body
// { postId } to force one). Reads config straight from process.env so it doesn't
// depend on SvelteKit's $env, and decrypts client tokens with the pure
// cryptoCore + TOKEN_ENCRYPTION_KEY.
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { runAllDue, publishSingle, type Deps } from '../../src/lib/server/engine/run';
import { decrypt } from '../../src/lib/cryptoCore';

export default async function handler(req: Request): Promise<Response> {
	if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
		return new Response('Unauthorized', { status: 401 });
	}

	const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
		auth: { persistSession: false, autoRefreshToken: false },
		realtime: { transport: ws as unknown as typeof WebSocket }
	});
	const key = process.env.TOKEN_ENCRYPTION_KEY!;
	const deps: Deps = { db, decrypt: (cipher: string) => decrypt(cipher, key) };

	let postId: string | undefined;
	try {
		postId = (await req.json())?.postId;
	} catch {
		// no/invalid body → run all due
	}

	try {
		if (postId) {
			await publishSingle(postId, deps);
			console.log(`[publish-bg] published single ${postId}`);
		} else {
			const summary = await runAllDue(deps);
			console.log(`[publish-bg] due run: ${JSON.stringify(summary)}`);
		}
	} catch (err) {
		console.error('[publish-bg] error:', err instanceof Error ? err.message : err);
	}
	return new Response('ok');
}
