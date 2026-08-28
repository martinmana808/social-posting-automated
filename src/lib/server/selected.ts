// Resolves which client the operator is currently working on. The selection is
// stored in a cookie; falls back to the first client. Single source of truth for
// both load functions and form actions.
import type { Cookies } from '@sveltejs/kit';
import { listClients, type ClientPublic } from './clients';

export const SELECTED_COOKIE = 'spa_client';

export async function selectedClient(cookies: Cookies): Promise<ClientPublic | null> {
	const clients = await listClients();
	const id = cookies.get(SELECTED_COOKIE);
	return clients.find((c) => c.id === id) ?? clients[0] ?? null;
}
