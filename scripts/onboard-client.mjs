// Onboard (or reconnect) a client from a short-lived user token.
//
// Prereq: the client has added YOU as an admin/editor on their Facebook Page
// (Meta Business Suite), and their Instagram is a Business/Creator account
// linked to that Page.
//
// 1. Open Graph API Explorer (https://developers.facebook.com/tools/explorer),
//    select your Meta app, and "Get User Access Token" with:
//      pages_show_list, pages_read_engagement, pages_manage_posts,
//      instagram_basic, instagram_content_publish, business_management
// 2. Run:
//      node --env-file=.env scripts/onboard-client.mjs <client-slug> <USER_TOKEN> [pageId]
//    Omit pageId to list the Pages you manage; then re-run with the right one.
//
// Creates the client row if the slug doesn't exist, encrypts the Page token, and
// stores fb_page_id / ig_user_id so the scheduler can publish for them.
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, randomBytes } from 'node:crypto';
import ws from 'ws';

const [slug, userToken, wantPageId] = process.argv.slice(2);
if (!slug || !userToken) {
	console.error('Usage: node --env-file=.env scripts/onboard-client.mjs <slug> <user_token> [pageId]');
	process.exit(1);
}

const V = process.env.META_GRAPH_VERSION || 'v21.0';
const base = `https://graph.facebook.com/${V}`;
const KEY = process.env.TOKEN_ENCRYPTION_KEY;
if (!KEY || Buffer.from(KEY, 'hex').length !== 32) {
	console.error('TOKEN_ENCRYPTION_KEY must be 64 hex chars. Generate: openssl rand -hex 32');
	process.exit(1);
}

function encryptToken(plaintext) {
	const iv = randomBytes(12);
	const c = createCipheriv('aes-256-gcm', Buffer.from(KEY, 'hex'), iv);
	const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
	return [iv.toString('hex'), c.getAuthTag().toString('hex'), ct.toString('hex')].join(':');
}

async function get(path, params) {
	const url = new URL(`${base}/${path}`);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	const res = await fetch(url);
	const body = await res.json();
	if (body.error) throw new Error(body.error.message);
	return body;
}

// short-lived -> long-lived user token
const long = await get('oauth/access_token', {
	grant_type: 'fb_exchange_token',
	client_id: process.env.META_APP_ID,
	client_secret: process.env.META_APP_SECRET,
	fb_exchange_token: userToken
});

const pages = await get('me/accounts', {
	fields: 'id,name,access_token,instagram_business_account{id,username}',
	access_token: long.access_token
});
if (!pages.data?.length) {
	console.error('No Pages found. Make sure you are an admin/editor on the client\'s Page.');
	process.exit(1);
}

let page = pages.data.find((p) => p.id === wantPageId);
if (!page) {
	if (pages.data.length === 1) {
		page = pages.data[0];
	} else {
		console.log('\nYou manage several Pages — re-run with the right pageId:\n');
		for (const p of pages.data) console.log(`  ${p.id}  ${p.name}`);
		console.log('');
		process.exit(0);
	}
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false },
	realtime: { transport: ws }
});

// Find or create the client row by slug.
let { data: client } = await db.from('clients').select('id').eq('slug', slug).single();
if (!client) {
	const { data, error } = await db
		.from('clients')
		.insert({ name: page.name, slug })
		.select('id')
		.single();
	if (error) {
		console.error('❌ create client:', error.message);
		process.exit(1);
	}
	client = data;
	console.log(`Created client "${slug}".`);
}

const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
const { error } = await db
	.from('clients')
	.update({
		fb_page_id: page.id,
		fb_page_name: page.name,
		fb_page_token: encryptToken(page.access_token),
		ig_user_id: page.instagram_business_account?.id ?? null,
		ig_username: page.instagram_business_account?.username ?? null,
		token_expires_at: expiresAt,
		status: 'active'
	})
	.eq('id', client.id);
if (error) {
	console.error('❌ save credentials:', error.message);
	process.exit(1);
}

console.log(`\n✅ Connected "${slug}" → ${page.name} (${page.id})`);
console.log('   instagram:', page.instagram_business_account?.username
	? '@' + page.instagram_business_account.username
	: '(none linked — Facebook-only)');
console.log('   token encrypted + stored · expires ~', expiresAt.slice(0, 10), '\n');
