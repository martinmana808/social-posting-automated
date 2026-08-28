// Publishing to a client Facebook Page.
//   1 image  -> POST /{page-id}/photos (published)
//   N images -> upload each unpublished, then POST /{page-id}/feed with
//               attached_media referencing them (a multi-photo post).
import { graphPost, type FetchLike } from './client';

/** Publish a single photo + caption to the Page. Returns the feed post id. */
export async function publishPhoto(
	pageId: string,
	pageToken: string,
	imageUrl: string,
	caption: string,
	fetchImpl: FetchLike = fetch
): Promise<string> {
	const res = await graphPost(
		`${pageId}/photos`,
		{ url: imageUrl, caption, published: 'true', access_token: pageToken },
		fetchImpl
	);
	return res.post_id ?? res.id;
}

/** Publish multiple photos as one Page post. Returns the feed post id. */
export async function publishMultiPhoto(
	pageId: string,
	pageToken: string,
	imageUrls: string[],
	caption: string,
	fetchImpl: FetchLike = fetch
): Promise<string> {
	const mediaFbids: string[] = [];
	for (const url of imageUrls) {
		const uploaded = await graphPost(
			`${pageId}/photos`,
			{ url, published: 'false', access_token: pageToken },
			fetchImpl
		);
		mediaFbids.push(uploaded.id);
	}
	const params: Record<string, string> = { message: caption, access_token: pageToken };
	mediaFbids.forEach((id, i) => {
		params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
	});
	const res = await graphPost(`${pageId}/feed`, params, fetchImpl);
	return res.id;
}

/** Post to Facebook, choosing single vs multi-photo by image count. */
export async function publishFacebook(
	pageId: string,
	pageToken: string,
	imageUrls: string[],
	caption: string,
	fetchImpl: FetchLike = fetch
): Promise<string> {
	return imageUrls.length === 1
		? publishPhoto(pageId, pageToken, imageUrls[0], caption, fetchImpl)
		: publishMultiPhoto(pageId, pageToken, imageUrls, caption, fetchImpl);
}
