# HANDOFF — read this first (fresh-conversation context)

Updated 2026-07-01, replacing the 2026-06-11 version below — a lot shipped
since then. This file lives IN this repo; you're already in the right directory.

## The user
Runs a NZ STIHL dealer business AND a personal design studio **F925** (he's
based in **Argentina**). Fast-moving, "just build it / YOLO" style, but wants
previews before things go public. Terse feedback; pay attention to corrections.

## ⛔ Don't Read image files into the main conversation
Reading .png/.jpg with the Read tool in the main thread has previously blown up
context/quota. If you need to SEE an image, dispatch a subagent to look at it
and describe it back in text. Resize big images first if needed
(`sips -Z 1400 in.png --out /tmp/x.png`).

## What this project is
Single-account auto-poster for the user's own **F925 Studio** Facebook Page +
Instagram. A content plan (CSV or hand-built JSON) → scheduled **carousel**
posts to FB + IG, published automatically on a timer. No dealers, no OAuth
onboarding, no Meta App Review — posting to your own account works in Meta dev
mode. There's a sibling project, `../social-automated-posting` (the 90-dealer
STIHL version) — unrelated to day-to-day F925 work, paused at Meta App Review;
ignore it unless the user asks for it specifically.

- Stack: SvelteKit + Supabase + Netlify. Deploys are MANUAL:
  `netlify deploy --build --prod` (no CI wired).
- Live: **https://f925-auto-posting.netlify.app** (admin login pw = `ADMIN_PASSWORD` in `.env`).
- GitHub: `github.com/martinmana808/f925-auto-posting` (private, `main`).
- Secrets in `.env` (gitignored) — FB_PAGE_ID/FB_PAGE_TOKEN/IG_USER_ID for the F925
  Studio Page + IG, Supabase creds (shared project, but `posts` table is F925-only),
  ADMIN_PASSWORD, CRON_SECRET, `POST_TIMEZONE` (currently `Pacific/Auckland` — NZ time
  — but re-check `.env` directly, don't trust this file for that value).

## Architecture, current as of this handoff
- **Scheduler:** Netlify **background** function `netlify/functions/publish-due-background.mts`
  (moved off the old 10s synchronous function — IG carousels take ~55s to publish,
  Instagram downloads each slide server-side at ~8-10s/image, and the old function
  got killed mid-publish). `publish-due.mts` now just kicks off the background
  function. Runs every 15 min, publishes `posts` rows where `status='pending'` and
  `scheduled_at <= now`. `image_url` is `|`-joined URLs; >1 = carousel (FB multi-photo
  / IG carousel). `status='draft'` is ignored by the scheduler.
- **In-app post editor** (`src/routes/+page.svelte` + `src/lib/components/PostCard.svelte`):
  the dashboard is now a lightweight CMS, not just read-only preview. For `draft`/
  `pending` posts you can add/delete/reorder slide images (upload goes straight to
  Supabase via a signed URL, bypassing Netlify's ~4.5MB payload limit), edit the
  caption, and change the scheduled date/time (picked in NZ time, stored UTC).
  Published/publishing/failed rows have no Edit button; server re-checks status on
  every write. Design doc: `docs/superpowers/specs/2026-06-13-post-editor-design.md`.
- **IG_USER_ID is optional** — engine posts FB-only if no IG linked.
- Timezone math goes through `src/lib/datetime.ts` (`zonedToUtc`/`utcToZonedInput`,
  DST-correct) — used by both the compile pipeline and the editor.

## Content pipeline (CSV → scheduled carousels)
- `content-plan/sample-posts.csv` columns: `date,time,pattern,work_images,quote,
  quote_author,cta_image,title,blurb,hashtags`. Pattern letters = slide order
  (A=work image(s), B=generated quote slide, C=CTA/brand image), e.g. `ABC`.
- `scripts/upload-media.mjs` → hosts local images to the public `f925-media`
  bucket, writes `content-plan/media-urls.json`.
- `scripts/generate-quotes.mjs` → renders 1080×1350 black quote cards
  (@napi-rs/canvas, Arial Bold), writes `content-plan/quote-urls.json`.
- `scripts/compile-plan.mjs` → **deletes existing `draft` rows**, then resolves
  each CSV row's pattern into ordered URLs, composes the caption, inserts a
  `draft` post, and writes a contact-sheet PNG per post to `content-plan/previews/`.
- `scripts/activate-drafts.mjs` → flips `draft` → `pending` so the scheduler will
  actually publish them.
- `scripts/show-posts.mjs` → inspect DB post rows without pulling images into context.

## ⚠️ Uncommitted work in progress — check before doing anything else
`git status` shows two **untracked** scripts, never committed, not explained by
any commit message:
- `scripts/build-week.mjs` — builds a week of 5-slide carousels
  (work → extra → quote → b → c) from a `WEEK_CONFIG` JSON + a local
  `PROCESSED_DIR` of pre-resized (1440×1920, <8MB) images, uploads them, inserts
  as `draft` posts. Looks like a parallel/newer hand-built-batch path, distinct
  from the CSV-driven `compile-plan.mjs`.
- `scripts/update-captions.mjs` — bulk-updates captions on existing `draft` posts,
  matched by a slide filename in `image_url`.

**Before doing any content work: work out what batch was in progress** — ask the
user, or inspect `content-plan/` and run
`node --env-file=.env scripts/show-posts.mjs` to see the actual current DB state
(draft/pending/published rows, schedules, image URLs). Do not trust any older
assumption about DB state — the last time it was recorded was weeks ago.

## Gotchas / facts (still true)
- Manual posting to a FB **Page** + IG together must go through **Meta Business
  Suite** — IG's "Sharing across profiles" only targets a personal FB profile, not
  a Page.
- IG needs public HTTPS images; accepts 3:4 (0.75) aspect ratio.
- Supabase client needs the `ws` transport on Node 20 (no global WebSocket) —
  already wired into every script.
- `npm run check`, `npm test`, `npm run build` must stay green before deploying.

## Memory
The user also keeps cross-session memory notes in a *different* project's Claude
memory dir (`stihl-shop-tauranga`) about this repo — useful for history, but they
run weeks stale relative to this HANDOFF. Trust this file and the live repo state
over them.
