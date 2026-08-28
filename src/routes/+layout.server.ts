// Loads the client list + current selection for the top-bar switcher. Only runs
// the query for authenticated admins (unauthenticated hits go to /login).
import { listClients } from '$lib/server/clients';
import { SELECTED_COOKIE } from '$lib/server/selected';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	if (!locals.isAdmin) return { clients: [], selectedId: null };

	const clients = await listClients();
	let selectedId = cookies.get(SELECTED_COOKIE) ?? null;
	if (!clients.some((c) => c.id === selectedId)) selectedId = clients[0]?.id ?? null;

	return { clients, selectedId };
};
