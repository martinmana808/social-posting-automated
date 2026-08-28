// Test stand-in for SvelteKit's $env/dynamic/private.
export const env = process.env as Record<string, string | undefined>;
