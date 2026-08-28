# Multi-client social posting tool — design spec

*Brainstormed & approved 2026-08-28. Seeded from `f925-auto-posting`.*

## What this is

An **internal F925 operator tool** that schedules and publishes *finished*
content to **many clients'** Facebook Pages + Instagram Business accounts. Each
client is fully walled off (own accounts, own posts, own branding, own
schedule). One F925 admin login; **clients never touch it**.

This is **Path A** (managed, launch-fast): F925 connects each client's accounts
manually and manages content. No client logins, no OAuth self-onboarding, no
Meta App Review — it runs on Meta **Development mode** with F925 acting as a
Page admin on each client's Page. Known trade-offs: Page tokens expire ~60 days
(manual refresh, with a dashboard warning), and Dev mode is a gray area for
commercial use at scale. **Graduate to Path B** (OAuth + App Review + Advanced
Access, as the STIHL app pioneered) at ~10 clients.

## Architecture

Same stack as the seed: **SvelteKit (Svelte 5) + Supabase + Netlify**. Publishing
runs in a Netlify **background function** (15-min budget; IG carousels take ~10s
per image). The publish **engine is dependency-injected** (`runDuePosts({db,
account})`), which is what makes multi-tenant cheap: loop over clients from the
DB instead of one account from env.

## Data model (`supabase/migrations/0001_init.sql`)

- **`clients`** — one row per client: `name`, `slug`, `timezone`, `fb_page_id`,
  `fb_page_name`, **`fb_page_token` (encrypted, AES-256-GCM)**, `ig_user_id`,
  `ig_username`, `token_expires_at`, `status` (active | paused), `created_at`.
- **`posts`** — the seed's post table plus a **`client_id`** FK (NOT NULL, cascade
  delete). Every query is scoped by `client_id`.
- **RLS enabled** on both tables (the app uses the service-role key, which
  bypasses RLS; this just closes the public REST hole).

## Token security

- Client Page tokens are **encrypted at rest** (AES-256-GCM), ported from the
  STIHL app. The engine and the Netlify background function are env-agnostic:
  crypto lives in a pure `cryptoCore.ts` that takes the key as an argument, so
  the background function can decrypt with `process.env.TOKEN_ENCRYPTION_KEY`
  without importing SvelteKit's `$env`.

## Components

- **Engine** (`engine/run.ts`): `runAllDue({db, decrypt})` loops active,
  connected clients → per-client `runClientDue` (scoped by `client_id`) using an
  `account` decrypted from the client row. `publishSingle` resolves the client
  from the post. Idempotent per-platform (never double-posts).
- **Client switcher**: selected client stored in a cookie. The dashboard and
  editor operate entirely within the selected client's world.
- **Clients admin** (`/admin/clients`): add a client (name, slug, timezone), set
  its credentials (paste `fb_page_id` / `fb_page_token` / `ig_user_id` → encrypted
  server-side), pause/activate, see token-expiry warnings.
- **Onboarding script** (`scripts/onboard-client.mjs`): given a client slug and a
  user token, fetches the Page token + IG id via `me/accounts`, encrypts, and
  upserts the client row — the one-command operator path.
- **Editor** (reused): upload finished images (signed-URL upload to a per-client
  storage folder), reorder carousel slides, caption, schedule in the *client's*
  timezone. Plus CSV bulk ingest (now client-scoped).

## Client onboarding flow (operator)

1. Client adds **F925 as an admin/editor on their Facebook Page** (Meta Business
   Suite) and links an **Instagram Business/Creator account** to that Page.
2. F925 generates a user token (Graph API Explorer, the neutral Meta app) and
   runs `onboard-client.mjs <slug> <token>` — or pastes the creds into the
   clients admin. Token is encrypted and stored.
3. F925 uploads/schedules the client's content. The scheduler publishes it.

## Out of scope (v1)

Client logins, per-client content auto-generation, OAuth self-onboarding,
billing. All of these are the Path B / later upgrade.

## Testing

Unit tests for: token crypto round-trip, caption composition + CSV parse,
client-scoped due-post selection, per-platform idempotency, timezone math.
