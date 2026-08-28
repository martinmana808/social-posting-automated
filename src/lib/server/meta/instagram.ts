// Publishing to a client Instagram Business account.
//   1 image  -> create container -> media_publish
//   N images -> create a child container per image (is_carousel_item), wait for
//               each to finish, create a CAROUSEL parent, wait, then publish.
// image_url MUST be public HTTPS. Carousels are 2–10 images.
import { graphGet, graphPost, GraphError, type FetchLike } from './client';

async function createContainer(
	igUserId: string,
	token: string,
	params: Record<string, string>,
	fetchImpl: FetchLike
): Promise<string> {
	const res = await graphPost(`${igUserId}/media`, { ...params, access_token: token }, fetchImpl);
	return res.id as string;
}

async function publishContainer(
	igUserId: string,
	token: string,
	creationId: string,
	fetchImpl: FetchLike
): Promise<string> {
	const res = await graphPost(
		`${igUserId}/media_publish`,
		{ creation_id: creationId, access_token: token },
		fetchImpl
	);
	return res.id as string;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Poll a container's status_code until FINISHED (carousels need processing). */
async function waitUntilReady(
	containerId: string,
	token: string,
	fetchImpl: FetchLike,
	{ attempts = 12, delayMs = 2000, sleep = defaultSleep } = {}
): Promise<void> {
	for (let i = 0; i < attempts; i++) {
		const res = await graphGet(containerId, { fields: 'status_code', access_token: token }, fetchImpl);
		if (res.status_code === 'FINISHED') return;
		if (res.status_code === 'ERROR') throw new GraphError(`IG container ${containerId} failed`, 400);
		await sleep(delayMs);
	}
	throw new GraphError(`IG container ${containerId} not ready`, 408);
}

/** Publish a single image. */
export async function publishImage(
	igUserId: string,
	token: string,
	imageUrl: string,
	caption: string,
	fetchImpl: FetchLike = fetch
): Promise<string> {
	const id = await createContainer(igUserId, token, { image_url: imageUrl, caption }, fetchImpl);
	return publishContainer(igUserId, token, id, fetchImpl);
}

/** Publish a carousel (2–10 images). */
export async function publishCarousel(
	igUserId: string,
	token: string,
	imageUrls: string[],
	caption: string,
	fetchImpl: FetchLike = fetch,
	waiter = waitUntilReady
): Promise<string> {
	if (imageUrls.length < 2 || imageUrls.length > 10) {
		throw new GraphError('Instagram carousels need 2–10 images', 400);
	}
	const children: string[] = [];
	for (const url of imageUrls) {
		const childId = await createContainer(igUserId, token, { image_url: url, is_carousel_item: 'true' }, fetchImpl);
		await waiter(childId, token, fetchImpl);
		children.push(childId);
	}
	const parentId = await createContainer(
		igUserId,
		token,
		{ media_type: 'CAROUSEL', caption, children: children.join(',') },
		fetchImpl
	);
	await waiter(parentId, token, fetchImpl);
	return publishContainer(igUserId, token, parentId, fetchImpl);
}

/**
 * Find an already-live media with this exact caption among the account's most
 * recent posts. Meta sometimes publishes successfully but answers media_publish
 * with a rate-limit error, so the id is never returned; retrying blindly then
 * posts a duplicate. Checking recent media first makes retries idempotent.
 */
export async function findPublishedByCaption(
	igUserId: string,
	token: string,
	caption: string,
	fetchImpl: FetchLike = fetch
): Promise<string | null> {
	const wanted = caption.trim();
	if (!wanted) return null; // can't match reliably on an empty caption
	const res = await graphGet(
		`${igUserId}/media`,
		{ fields: 'id,caption', limit: '10', access_token: token },
		fetchImpl
	);
	const hit = ((res.data ?? []) as { id: string; caption?: string }[]).find(
		(m) => (m.caption ?? '').trim() === wanted
	);
	return hit?.id ?? null;
}

/** Post to Instagram, choosing single vs carousel by image count. */
export async function publishInstagram(
	igUserId: string,
	token: string,
	imageUrls: string[],
	caption: string,
	fetchImpl: FetchLike = fetch
): Promise<string> {
	return imageUrls.length === 1
		? publishImage(igUserId, token, imageUrls[0], caption, fetchImpl)
		: publishCarousel(igUserId, token, imageUrls, caption, fetchImpl);
}
