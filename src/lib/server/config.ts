// Validated env access. Missing keys fail loudly with a clear message.
//
// Note: unlike the single-account seed, there is NO FB_PAGE_ID / FB_PAGE_TOKEN /
// IG_USER_ID here — each client's credentials live (encrypted) in the `clients`
// table, not in env.
import { env } from '$env/dynamic/private';

function required(name: string): string {
	const value = env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}. See .env.example.`);
	}
	return value;
}
const optional = (name: string, fallback = '') => env[name] ?? fallback;

export const config = {
	meta: {
		graphVersion: () => optional('META_GRAPH_VERSION', 'v21.0'),
		// Only used by scripts/onboard-client.mjs (not the running app).
		appId: () => optional('META_APP_ID'),
		appSecret: () => optional('META_APP_SECRET')
	},
	posting: {
		// Fallback timezone when a client row has none. Each client normally sets
		// its own timezone.
		defaultTimeZone: () => optional('DEFAULT_TIMEZONE', 'Pacific/Auckland')
	},
	supabase: {
		url: () => required('SUPABASE_URL'),
		serviceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY')
	},
	security: {
		adminPassword: () => required('ADMIN_PASSWORD'),
		cronSecret: () => required('CRON_SECRET'),
		tokenEncryptionKey: () => required('TOKEN_ENCRYPTION_KEY')
	}
};
