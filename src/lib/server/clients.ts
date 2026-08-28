// Client CRUD + credential storage. Tokens are encrypted on write and never
// returned in plaintext to the browser.
import { supabase } from './supabase';
import { encryptToken } from './crypto';
import type { Client } from '$lib/types';

/** Fields safe to send to the browser — never the encrypted token itself. */
export type ClientPublic = Omit<Client, 'fb_page_token'> & { connected: boolean };

function toPublic(c: Client): ClientPublic {
	const { fb_page_token, ...rest } = c;
	return { ...rest, connected: Boolean(c.fb_page_id && fb_page_token) };
}

export async function listClients(): Promise<ClientPublic[]> {
	const { data } = await supabase()
		.from('clients')
		.select('*')
		.order('created_at', { ascending: true });
	return ((data ?? []) as Client[]).map(toPublic);
}

export async function getClient(id: string): Promise<ClientPublic | null> {
	const { data } = await supabase().from('clients').select('*').eq('id', id).single();
	return data ? toPublic(data as Client) : null;
}

/** Full row incl. encrypted token — server-only (e.g. for the engine). */
export async function getClientRaw(id: string): Promise<Client | null> {
	const { data } = await supabase().from('clients').select('*').eq('id', id).single();
	return (data as Client) ?? null;
}

export async function createClient(input: {
	name: string;
	slug: string;
	timezone: string;
}): Promise<{ id: string } | { error: string }> {
	const { data, error } = await supabase()
		.from('clients')
		.insert({ name: input.name, slug: input.slug, timezone: input.timezone })
		.select('id')
		.single();
	if (error) return { error: error.message };
	return { id: data.id };
}

export async function updateClient(
	id: string,
	patch: Partial<Pick<Client, 'name' | 'timezone' | 'status'>>
): Promise<void> {
	await supabase().from('clients').update(patch).eq('id', id);
}

export async function deleteClient(id: string): Promise<void> {
	await supabase().from('clients').delete().eq('id', id);
}

/** Store a client's Facebook/Instagram credentials, encrypting the token. */
export async function setClientCredentials(
	id: string,
	creds: {
		fb_page_id: string;
		fb_page_name?: string;
		fb_page_token: string;
		ig_user_id?: string;
		ig_username?: string;
		token_expires_at?: string | null;
	}
): Promise<void> {
	await supabase()
		.from('clients')
		.update({
			fb_page_id: creds.fb_page_id,
			fb_page_name: creds.fb_page_name ?? null,
			fb_page_token: encryptToken(creds.fb_page_token),
			ig_user_id: creds.ig_user_id || null,
			ig_username: creds.ig_username || null,
			token_expires_at: creds.token_expires_at ?? null
		})
		.eq('id', id);
}
