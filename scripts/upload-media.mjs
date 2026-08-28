// Upload local images to a public Supabase bucket and print the
// filename -> public URL map (also saved to content-plan/media-urls.json).
// Run with:  node --env-file=.env scripts/upload-media.mjs
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const BUCKET = 'client-media';
const ROOT = 'images-for-posting';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false },
	realtime: { transport: ws }
});

// Ensure a public bucket exists.
const { data: buckets } = await db.storage.listBuckets();
if (!buckets.find((b) => b.name === BUCKET)) {
	const { error } = await db.storage.createBucket(BUCKET, { public: true });
	if (error) throw error;
	console.log(`✅ created public bucket ${BUCKET}`);
}

const sanitize = (name) =>
	name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const isImage = (f) => ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(f).toLowerCase());

// Collect: top-level brand/cta images, and worksForPosting/* work images.
const jobs = [];
for (const f of readdirSync(ROOT)) {
	if (isImage(f)) jobs.push({ file: join(ROOT, f), key: `brand/${sanitize(f)}${extname(f)}`, orig: f });
}
const worksDir = join(ROOT, 'worksForPosting');
if (existsSync(worksDir)) {
	for (const f of readdirSync(worksDir)) {
		if (isImage(f)) jobs.push({ file: join(worksDir, f), key: `works/${sanitize(f)}${extname(f)}`, orig: f });
	}
}

const map = {};
for (const j of jobs) {
	const bytes = readFileSync(j.file);
	const ct = extname(j.file).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
	// Short cacheControl so updated imagery propagates quickly (for the preview).
	const { error } = await db.storage
		.from(BUCKET)
		.upload(j.key, bytes, { contentType: ct, upsert: true, cacheControl: '120' });
	if (error) {
		console.error(`❌ ${j.orig}: ${error.message}`);
		continue;
	}
	const { data } = db.storage.from(BUCKET).getPublicUrl(j.key);
	map[j.orig] = data.publicUrl;
	console.log(`✅ ${j.orig}`);
}

writeFileSync('content-plan/media-urls.json', JSON.stringify(map, null, 2));
console.log(`\n${Object.keys(map).length} files uploaded. Map saved to content-plan/media-urls.json`);
