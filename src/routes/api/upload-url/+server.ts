// POST /api/upload-url  { filename }  ->  { signedUrl, publicUrl }
// Admin-only: hooks.server.ts does not gate /api/*, so we check locals.isAdmin
// here. Files land in the selected client's folder. The browser PUTs the file to
// signedUrl, then saves publicUrl on the post.
import { json, error } from '@sveltejs/kit';
import { createSignedUpload } from '$lib/server/storage';
import { selectedClient } from '$lib/server/selected';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	if (!locals.isAdmin) throw error(401, 'Not authorised');

	const client = await selectedClient(cookies);
	if (!client) throw error(400, 'No client selected');

	let filename = '';
	try {
		({ filename } = await request.json());
	} catch {
		throw error(400, 'Expected JSON body');
	}
	if (!filename || typeof filename !== 'string') throw error(400, 'filename is required');

	try {
		const { signedUrl, publicUrl } = await createSignedUpload(client.id, filename);
		return json({ signedUrl, publicUrl });
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Could not create upload URL');
	}
};
