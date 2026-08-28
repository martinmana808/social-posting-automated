export type PostStatus = 'draft' | 'pending' | 'publishing' | 'published' | 'failed';
export type ClientStatus = 'active' | 'paused';

/** A managed client: their own social accounts, posts, schedule — fully isolated. */
export interface Client {
	id: string;
	name: string;
	slug: string;
	timezone: string;
	fb_page_id: string | null;
	fb_page_name: string | null;
	/** Encrypted at rest (AES-256-GCM); decrypt with decryptToken() before use. */
	fb_page_token: string | null;
	ig_user_id: string | null;
	ig_username: string | null;
	token_expires_at: string | null;
	status: ClientStatus;
	created_at: string;
}

export interface Post {
	id: string;
	client_id: string;
	scheduled_at: string;
	image_url: string;
	title: string;
	blurb: string;
	hashtags: string;
	caption: string;
	status: PostStatus;
	attempts: number;
	last_error: string | null;
	fb_post_id: string | null;
	ig_post_id: string | null;
	published_at: string | null;
	created_at: string;
}
