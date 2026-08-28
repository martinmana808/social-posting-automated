// A post's carousel slides are stored in `posts.image_url` as an ordered list of
// public URLs joined by "|" (matches compile-plan.mjs and publish.ts). These pure
// helpers convert between that string and an array, shared by client and server.

export function parseSlides(imageUrl: string): string[] {
	return imageUrl
		.split('|')
		.map((u) => u.trim())
		.filter(Boolean);
}

export function serializeSlides(urls: string[]): string {
	return urls.map((u) => u.trim()).filter(Boolean).join('|');
}
