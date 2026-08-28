// Throwaway env so importing server modules under vitest doesn't throw.
process.env.FB_PAGE_ID ??= 'PAGE';
process.env.FB_PAGE_TOKEN ??= 'token';
process.env.IG_USER_ID ??= 'IGUSER';
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test';
process.env.ADMIN_PASSWORD ??= 'test-pass';
process.env.CRON_SECRET ??= 'test-cron';
