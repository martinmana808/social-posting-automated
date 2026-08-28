// Image uploads for the post editor. We mint a Supabase *signed upload URL* on the
// server (service-role) and hand it to the browser, which PUTs the file straight
// to Supabase. This bypasses Netlify's ~4.5MB function-payload limit — design
// exports run well past that — and keeps the service-role key server-side.
//
// Files are stored under a per-client folder so clients never share media paths.
import { randomUUID } from 'node:crypto';
import { supabase } from './supabase';

const BUCKET = 'client-media';

/** Make a filesystem/URL-safe stem, preserving the extension. */
export function sanitizeName(name: string): string {
	const dot = name.lastIndexOf('.');
	const stem = (dot > 0 ? name.slice(0, dot) : name)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
	const safeStem = stem || 'image';
	return ext ? `${safeStem}.${ext}` : safeStem;
}

export interface SignedUpload {
	signedUrl: string; // absolute URL the browser PUTs the file to
	publicUrl: string; // where the file will be served once uploaded
	path: string;
}

/** Create a one-shot signed upload URL under <clientId>/<uuid>-<name>. */
export async function createSignedUpload(
	clientId: string,
	filename: string
): Promise<SignedUpload> {
	const path = `${clientId}/${randomUUID()}-${sanitizeName(filename)}`;
	const db = supabase();
	const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
	if (error) throw error;
	const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
	return { signedUrl: data.signedUrl, publicUrl: pub.publicUrl, path };
}
