// Server-side Supabase client (service role). Never import into client code.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { config } from './config';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
	if (!client) {
		client = createClient(config.supabase.url(), config.supabase.serviceRoleKey(), {
			auth: { persistSession: false, autoRefreshToken: false },
			// Node < 22 has no global WebSocket; supabase-js builds a Realtime
			// client eagerly, so inject `ws` even though we never use Realtime.
			realtime: { transport: ws as unknown as typeof WebSocket }
		});
	}
	return client;
}
