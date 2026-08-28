// Smoke test: insert one post dated "now" for a client so the next publish run
// sends it.
// Run with:  node --env-file=.env scripts/seed-now-post.mjs <client-slug>
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const slug = process.argv[2];
if (!slug) {
	console.error('Usage: node --env-file=.env scripts/seed-now-post.mjs <client-slug>');
	process.exit(1);
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false },
	realtime: { transport: ws }
});

const { data: client } = await db.from('clients').select('id,name').eq('slug', slug).single();
if (!client) {
	console.error(`No client with slug "${slug}". Create one first.`);
	process.exit(1);
}

const due = new Date(Date.now() - 60_000).toISOString();
const { data, error } = await db
	.from('posts')
	.insert({
		client_id: client.id,
		scheduled_at: due,
		image_url: 'https://picsum.photos/seed/spa-smoke/1080',
		title: '🧪 Test post',
		blurb: 'Verifying the poster — safe to ignore / delete.',
		hashtags: '#test',
		caption: '🧪 Test post — safe to ignore / delete.\n\n#test',
		status: 'pending'
	})
	.select('id')
	.single();

if (error) {
	console.error('❌', error.message);
	process.exit(1);
}
console.log(`✅ Seeded test post ${data.id} for "${client.name}" (due ${due})`);
console.log('Now publish it: curl -X POST $URL/api/cron -H "x-cron-secret: $CRON_SECRET"');
