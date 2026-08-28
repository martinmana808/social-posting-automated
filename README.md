# social-posting-automated

An internal F925 operator tool that schedules and publishes **finished content**
to **many clients'** Facebook Pages + Instagram Business accounts. Each client is
fully isolated — their own accounts, posts, schedule, timezone. One admin login;
clients never touch it.

This is **Path A** (managed, launch-fast): F925 connects each client's accounts
manually. No client logins, no OAuth self-onboarding, no Meta App Review — it
runs in Meta Development mode with F925 acting as a Page admin. See `docs/DESIGN.md`.

## How it works

```
Per client (once): client adds F925 as a Page admin → onboard-client.mjs stores
                   an encrypted Page token
Per client (ongoing): upload finished images + caption, schedule (client's tz)
Netlify cron (every 15 min) → background function → publishes each client's due
                   posts to their FB + IG
```

## Stack

SvelteKit (Svelte 5) · Supabase (Postgres + Storage) · Netlify (background +
scheduled functions) · Meta Graph API.

## Setup

### 1. Install
```bash
npm install
cp .env.example .env   # then fill it in
```

### 2. Supabase (a NEW project, isolated from other tools)
1. Create a project at supabase.com.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor (creates `clients`
   + `posts`, with RLS enabled).
3. Create a **public** Storage bucket named `client-media` (Instagram needs
   public image URLs).
4. Put the project URL + **service-role** key in `.env`.

### 3. Secrets
```bash
openssl rand -hex 32   # -> TOKEN_ENCRYPTION_KEY
openssl rand -hex 24   # -> CRON_SECRET
```
Set `ADMIN_PASSWORD` too. Put your neutral Meta app's id/secret in `.env` (only
used by the onboarding script).

### 4. Run
```bash
npm run dev   # http://localhost:5182  (password = ADMIN_PASSWORD)
```

## Onboarding a client

1. The client adds **you (F925) as an admin/editor on their Facebook Page** (Meta
   Business Suite) and links an **Instagram Business/Creator account** to it.
2. In Graph API Explorer (your neutral Meta app), get a **User Access Token**
   with: `pages_show_list, pages_read_engagement, pages_manage_posts,
   instagram_basic, instagram_content_publish, business_management`.
3. Run:
   ```bash
   node --env-file=.env scripts/onboard-client.mjs <client-slug> <USER_TOKEN>
   ```
   (Omit the page id to list Pages, then re-run with the right one.)
   Or paste the values into **Clients → Set credentials** in the UI.

Page tokens last ~60 days; the Clients page warns when one is expiring — re-run
the onboarding step to refresh.

## Everyday use

- Pick the client in the top-bar switcher.
- **+ New post** (upload images, caption, schedule) or **Add posts from CSV**.
- **Publish anything due now** (or wait for the 15-min cron).

## Scripts

```bash
node --env-file=.env scripts/onboard-client.mjs <slug> <token> [pageId]
node --env-file=.env scripts/show-posts.mjs [slug]
node --env-file=.env scripts/seed-now-post.mjs <slug>   # smoke test
```

## Verify
```bash
npm test        # crypto, CSV parse, publish engine, timezone math
npm run check   # types
```

## Deploy (manual)
```bash
netlify deploy --build --prod
```
Set all `.env` values in Netlify's environment (Site settings → Environment
variables). The scheduled function `publish-due` runs every 15 minutes.
