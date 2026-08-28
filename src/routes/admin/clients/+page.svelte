<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	const COMMON_TZ = [
		'Pacific/Auckland',
		'Australia/Sydney',
		'America/Argentina/Buenos_Aires',
		'America/New_York',
		'America/Los_Angeles',
		'Europe/London',
		'Europe/Madrid',
		'Asia/Tokyo',
		'UTC'
	];

	/** Days until a token expires (negative = already expired). */
	function daysLeft(iso: string | null): number | null {
		if (!iso) return null;
		return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
	}

	let openCreds = $state<string | null>(null);
</script>

<svelte:head><title>Clients</title></svelte:head>

<h1>Clients</h1>

<details class="help">
	<summary>How to connect a client</summary>
	<ol>
		<li>The client adds <b>you (F925) as an admin or editor on their Facebook Page</b> (Meta
			Business Suite → their Page → Settings → Page access), and makes sure their Instagram is a
			<b>Business or Creator account linked to that Page</b>. A personal Instagram can't be posted to.</li>
		<li>Add the client below (name, a short slug, their timezone).</li>
		<li>Get a <b>User Access Token</b> in the
			<a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer">Graph API Explorer</a>
			(your Meta app) with these permissions: <code>pages_show_list, pages_read_engagement,
			pages_manage_posts, instagram_basic, instagram_content_publish, business_management</code>.</li>
		<li>Either run <code>node --env-file=.env scripts/onboard-client.mjs &lt;slug&gt; &lt;token&gt;</code>,
			or click <b>Set credentials</b> and paste the Page ID, token, and (optional) Instagram user ID.
			The token is encrypted before it's stored.</li>
	</ol>
	<p class="muted small">
		Page tokens last about 60 days — this page shows a warning when one is close to expiring.
		Re-run the onboarding step to refresh it. <b>Pause</b> a client to stop all their scheduled posts
		without deleting anything.
	</p>
</details>

{#if form?.error}<p class="err">{form.error}</p>{/if}
{#if form?.created}<p class="ok">✓ Client created.</p>{/if}
{#if form?.credsSet}<p class="ok">✓ Credentials saved.</p>{/if}

<section class="add">
	<h2>Add a client</h2>
	<form method="POST" action="?/create" use:enhance>
		<div class="row">
			<label>Name<input name="name" placeholder="Acme Ltd" required /></label>
			<label>Slug<input name="slug" placeholder="acme" required /></label>
			<label>Timezone
				<input name="timezone" list="tzs" value="Pacific/Auckland" required />
				<datalist id="tzs">
					{#each COMMON_TZ as tz}<option value={tz}></option>{/each}
				</datalist>
			</label>
			<button class="primary" type="submit">Add client</button>
		</div>
	</form>
</section>

<section class="list">
	{#each data.clients as c (c.id)}
		{@const dl = daysLeft(c.token_expires_at)}
		<article class="client">
			<header>
				<div>
					<b>{c.name}</b> <span class="muted">/{c.slug} · {c.timezone}</span>
					<span class="badge {c.status === 'active' ? 'published' : 'draft'}">{c.status}</span>
				</div>
				<div class="conn">
					{#if c.connected}
						<span class="ok">● Connected</span>
						{#if c.fb_page_name}<span class="muted">{c.fb_page_name}</span>{/if}
						{#if c.ig_username}<span class="muted">· @{c.ig_username}</span>{/if}
						{#if dl !== null}
							<span class:warn={dl < 14} class="muted">
								· token {dl < 0 ? 'EXPIRED' : `${dl}d left`}
							</span>
						{/if}
					{:else}
						<span class="warn">● Not connected</span>
					{/if}
				</div>
			</header>

			<div class="actions">
				<button type="button" onclick={() => (openCreds = openCreds === c.id ? null : c.id)}>
					{c.connected ? 'Update credentials' : 'Set credentials'}
				</button>
				<form method="POST" action="?/setStatus" use:enhance>
					<input type="hidden" name="id" value={c.id} />
					<input type="hidden" name="status" value={c.status === 'active' ? 'paused' : 'active'} />
					<button type="submit">{c.status === 'active' ? 'Pause' : 'Activate'}</button>
				</form>
				<form method="POST" action="?/remove" use:enhance>
					<input type="hidden" name="id" value={c.id} />
					<button class="danger" type="submit">Delete</button>
				</form>
			</div>

			{#if openCreds === c.id}
				<form method="POST" action="?/setCreds" class="creds" use:enhance={() => async ({ result, update }) => {
					if (result.type === 'success') openCreds = null;
					await update();
				}}>
					<input type="hidden" name="id" value={c.id} />
					<p class="muted small">
						Generate a Page token for this client (Graph API Explorer, or
						<code>scripts/onboard-client.mjs</code>) and paste the values. Token is encrypted before storage.
					</p>
					<div class="grid">
						<label>Facebook Page ID<input name="fb_page_id" required /></label>
						<label>Facebook Page name<input name="fb_page_name" placeholder="(optional)" /></label>
						<label>Instagram user ID<input name="ig_user_id" placeholder="(optional — FB-only if blank)" /></label>
						<label>Instagram username<input name="ig_username" placeholder="(optional)" /></label>
					</div>
					<label class="full">Page access token<textarea name="fb_page_token" rows="3" required></textarea></label>
					<button class="primary" type="submit">Save credentials</button>
				</form>
			{/if}
		</article>
	{/each}
	{#if data.clients.length === 0}
		<p class="muted center">No clients yet — add your first above.</p>
	{/if}
</section>

<p class="back"><a href="/">← Back to posts</a></p>

<style>
	.help {
		background: #fbf7ec;
		border: 1px solid #ecdfc0;
		border-radius: 10px;
		padding: 0.8rem 1.1rem;
		margin-bottom: 1.2rem;
		font-size: 0.9rem;
	}
	.help summary {
		cursor: pointer;
		font-weight: 700;
	}
	.help ol {
		margin: 0.6rem 0 0.4rem;
		padding-left: 1.2rem;
	}
	.help li {
		margin-bottom: 0.4rem;
	}
	.help a {
		color: #1e40af;
	}
	h2 {
		margin: 0 0 0.6rem;
		font-size: 1rem;
	}
	.add,
	.client {
		background: #fff;
		border-radius: 10px;
		padding: 1rem 1.2rem;
		margin-bottom: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}
	.row {
		display: flex;
		gap: 0.8rem;
		align-items: flex-end;
		flex-wrap: wrap;
	}
	label {
		display: flex;
		flex-direction: column;
		font-size: 0.75rem;
		font-weight: 700;
		color: #777;
		gap: 0.25rem;
	}
	input,
	textarea {
		font: inherit;
		font-weight: 400;
		padding: 0.4rem 0.5rem;
		border: 1px solid #ccc;
		border-radius: 6px;
	}
	.client header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.conn {
		font-size: 0.82rem;
		display: flex;
		gap: 0.3rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.warn {
		color: #946200;
		font-weight: 600;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.8rem;
		flex-wrap: wrap;
	}
	.creds {
		margin-top: 0.9rem;
		border-top: 1px solid #eee;
		padding-top: 0.9rem;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
		margin-bottom: 0.6rem;
	}
	.full {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.6rem;
	}
	.full textarea {
		width: 100%;
		box-sizing: border-box;
		font-family: monospace;
		font-size: 0.8rem;
	}
	.small {
		font-size: 0.75rem;
	}
	.center {
		text-align: center;
	}
	.back {
		margin-top: 1rem;
	}
	.back a {
		color: #1e40af;
		text-decoration: none;
	}
	code {
		background: #eee;
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
	}
</style>
