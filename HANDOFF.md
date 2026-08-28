# HANDOFF — read this first

Created 2026-08-28. This file lives IN this repo; you're already in the right
directory (`social-posting-automated`).

## What this project is

An internal **F925 operator tool** that schedules and publishes **finished
content** to **many clients'** Facebook Pages + Instagram Business accounts. Each
client is fully isolated (own accounts, posts, schedule, timezone). One admin
login; clients never touch it. **Path A** (managed, launch-fast): F925 connects
each client's accounts manually, runs in Meta **Development mode**, no App Review.

- Seeded from `../f925-auto-posting` (kept running untouched).
- Full design: `docs/DESIGN.md`. Everyday usage: `README.md`.
- Stack: SvelteKit + Supabase + Netlify + Meta Graph API. Deploys are MANUAL
  (`netlify deploy --build --prod`).

## Status: BUILT + TESTED, not yet deployed (needs your accounts)

Code is complete and verified locally: **32 tests pass**, typecheck + build are
clean, the dev server boots and auth works. What remains is provisioning (only
you can do these — they need your Supabase/Meta/Netlify accounts).

### Go-live checklist

1. **Supabase** — create a NEW project (isolated from other tools). In the SQL
   editor run `supabase/migrations/0001_init.sql` (creates `clients` + `posts`,
   RLS on). Create a **public** Storage bucket named **`client-media`**. Copy the
   project URL + service-role key.
2. **Neutral Meta app** — create a client-agnostic Business app (e.g. "F925
   Social"), add **Facebook Login** + **Instagram** products. Note the App ID +
   Secret. (Clients never see a consent screen — F925 generates tokens as a Page
   admin — but keep it separate from the STIHL app.)
3. **`.env`** — `cp .env.example .env` and fill: Supabase URL + service-role key,
   `TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`), `ADMIN_PASSWORD`,
   `CRON_SECRET` (`openssl rand -hex 24`), `META_APP_ID`/`META_APP_SECRET`.
4. **Deploy** — `netlify deploy --build --prod` (create/link a new Netlify site).
   Set every `.env` value in Netlify → Site settings → Environment variables. The
   scheduled function `publish-due` runs every 15 min.
5. **Onboard the first client** — the client adds F925 as an **admin/editor on
   their Facebook Page** (Meta Business Suite) + links an **IG Business/Creator
   account**. Get a user token in Graph API Explorer, then:
   `node --env-file=.env scripts/onboard-client.mjs <slug> <USER_TOKEN>`
   (or paste creds in **Clients → Set credentials**).
6. **Smoke test** — `node --env-file=.env scripts/seed-now-post.mjs <slug>` then
   hit **Publish anything due now**; confirm it lands on the client's FB + IG.

## Architecture notes

- **Engine** (`src/lib/server/engine/run.ts`): `runAllDue({db, decrypt})` loops
  active, connected clients → per-client `runClientDue` scoped by `client_id`,
  using an `account` decrypted from the client row. Idempotent per platform
  (persists fb/ig ids as they land; recovers already-live IG posts on retry).
- **Crypto** is split: pure `src/lib/cryptoCore.ts` (key passed in) + server
  wrapper `src/lib/server/crypto.ts`. The Netlify background function decrypts
  with `process.env.TOKEN_ENCRYPTION_KEY` — no `$env` dependency.
- **Client selection** is a cookie (`spa_client`); `selectedClient(cookies)` is
  the single source of truth for load functions + actions.
- **Publishing** runs in the Netlify **background** function (15-min budget) in
  prod; inline in dev. IG carousels take ~10s/image.
- Tokens expire ~60 days; the Clients page warns when one is close — re-run
  `onboard-client.mjs` to refresh.

## Graduation trigger (Path A → Path B)

At ~10 clients (or before), move to OAuth self-onboarding + Meta App Review +
Advanced Access (as the STIHL app `../social-automated-posting` pioneered), with
a neutral consent-screen brand and long-lived tokens. Path A's Dev-mode +
manual-token model is deliberately a "get going now, graduate later" choice.

## Not done / notes

- Nothing pushed to GitHub yet (local commits only).
- No client-facing UI, no per-client content generation (out of scope by design).
