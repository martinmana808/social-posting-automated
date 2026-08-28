-- social-posting-automated :: two tables.
--
--   clients — one managed client: their own FB Page + linked IG account, their
--             own timezone, their own (encrypted) access token. Fully isolated.
--   posts   — one piece of content for ONE client, published to BOTH that
--             client's Facebook Page and Instagram. Scoped by client_id.
--
-- The scheduler loops over active clients and publishes each client's due posts
-- using that client's token. fb_post_id / ig_post_id are filled as each platform
-- succeeds, so retries never double-post a platform that already went out.

create table if not exists clients (
	id                uuid primary key default gen_random_uuid(),
	name              text not null,
	slug              text not null unique,
	timezone          text not null default 'Pacific/Auckland',
	-- Facebook Page
	fb_page_id        text,
	fb_page_name      text,
	-- Encrypted long-lived Page access token (see src/lib/server/crypto.ts).
	fb_page_token     text,
	-- Instagram Business account linked to the Page above.
	ig_user_id        text,
	ig_username       text,
	token_expires_at  timestamptz,
	-- active | paused
	status            text not null default 'active',
	created_at        timestamptz not null default now()
);

create table if not exists posts (
	id            uuid primary key default gen_random_uuid(),
	client_id     uuid not null references clients (id) on delete cascade,
	scheduled_at  timestamptz not null,
	image_url     text not null,
	title         text not null default '',
	blurb         text not null default '',
	hashtags      text not null default '',
	caption       text not null default '',
	-- draft | pending | publishing | published | failed
	status        text not null default 'pending',
	attempts      int not null default 0,
	last_error    text,
	fb_post_id    text,
	ig_post_id    text,
	published_at  timestamptz,
	created_at    timestamptz not null default now()
);

create index if not exists posts_client_due_idx
	on posts (client_id, status, scheduled_at)
	where status = 'pending';

create index if not exists posts_client_idx on posts (client_id);

-- Row-Level Security: the app uses the service-role key (which bypasses RLS).
-- Enabling RLS with no policies closes the public REST hole for the anon role.
alter table clients enable row level security;
alter table posts   enable row level security;
