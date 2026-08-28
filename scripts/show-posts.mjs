// Inspect recent posts + their published ids, optionally for one client.
// Run with:  node --env-file=.env scripts/show-posts.mjs [client-slug]
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const slug = process.argv[2];
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false },
	realtime: { transport: ws }
});

const { data: clients } = await db.from('clients').select('id,name,slug,status');
const byId = Object.fromEntries((clients ?? []).map((c) => [c.id, c]));
console.log(`Clients: ${(clients ?? []).map((c) => c.slug + (c.status === 'paused' ? '(paused)' : '')).join(', ') || '(none)'}\n`);

let q = db.from('posts').select('*').order('created_at', { ascending: false }).limit(15);
if (slug) {
	const client = (clients ?? []).find((c) => c.slug === slug);
	if (!client) {
		console.error(`No client with slug "${slug}".`);
		process.exit(1);
	}
	q = q.eq('client_id', client.id);
}

const { data, error } = await q;
if (error) {
	console.error('❌', error.message);
	process.exit(1);
}
for (const p of data ?? []) {
	console.log('────────────────────────────────────────');
	console.log('client  :', byId[p.client_id]?.name ?? p.client_id);
	console.log('when    :', p.scheduled_at);
	console.log('status  :', p.status, `(attempts ${p.attempts})`);
	console.log('caption :', (p.caption ?? '').replace(/\n+/g, ' / ').slice(0, 70));
	console.log('fb_id   :', p.fb_post_id ?? '—');
	console.log('ig_id   :', p.ig_post_id ?? '—');
	if (p.last_error) console.log('error   :', p.last_error);
	if (p.fb_post_id) console.log('fb_link : https://www.facebook.com/' + p.fb_post_id);
}
console.log('────────────────────────────────────────');
