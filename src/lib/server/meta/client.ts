// Thin Graph API wrapper (ported from the proven STIHL project).
// Env-agnostic on purpose: reads the Graph version from process.env (default
// v21.0) rather than $lib config, so the publish engine can run both inside
// SvelteKit and inside a plain Netlify background function.

export type FetchLike = typeof globalThis.fetch;

export class GraphError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code?: number,
		readonly fbtraceId?: string
	) {
		super(message);
		this.name = 'GraphError';
	}
	get isTransient(): boolean {
		const transientCodes = [1, 2, 4, 17, 32, 613];
		return this.status >= 500 || (this.code !== undefined && transientCodes.includes(this.code));
	}
}

const base = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`;

async function parse(res: Response): Promise<any> {
	const text = await res.text();
	let body: any = {};
	try {
		body = text ? JSON.parse(text) : {};
	} catch {
		throw new GraphError(`Non-JSON response: ${text.slice(0, 200)}`, res.status);
	}
	if (body.error) {
		throw new GraphError(body.error.message ?? 'Unknown Graph error', res.status, body.error.code, body.error.fbtrace_id);
	}
	if (!res.ok) throw new GraphError(`HTTP ${res.status}`, res.status);
	return body;
}

export async function graphGet(path: string, params: Record<string, string>, fetchImpl: FetchLike = fetch) {
	const url = new URL(`${base()}/${path}`);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	return parse(await fetchImpl(url, { method: 'GET' }));
}

export async function graphPost(path: string, params: Record<string, string>, fetchImpl: FetchLike = fetch) {
	const res = await fetchImpl(`${base()}/${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(params)
	});
	return parse(res);
}
