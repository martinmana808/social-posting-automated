<script lang="ts">
	import { page } from '$app/state';
	let { children, data } = $props();
	const showNav = $derived(
		page.url.pathname === '/' || page.url.pathname.startsWith('/admin')
	);
</script>

{#if showNav}
	<header>
		<a class="brand" href="/">Social Posting</a>
		<div class="right">
			{#if data.clients?.length}
				<form method="POST" action="/select-client" class="switcher">
					<select name="id" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
						{#each data.clients as c (c.id)}
							<option value={c.id} selected={c.id === data.selectedId}>
								{c.name}{c.status === 'paused' ? ' (paused)' : ''}
							</option>
						{/each}
					</select>
				</form>
			{/if}
			<a href="/admin/clients" class="nav">Clients</a>
			<form method="POST" action="/logout"><button>Log out</button></form>
		</div>
	</header>
{/if}
<div class="page">{@render children()}</div>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, -apple-system, sans-serif;
		background: #f6f6f4;
		color: #1a1a1a;
	}
	:global(button) {
		padding: 0.45rem 0.8rem;
		border: 0;
		border-radius: 6px;
		background: #e7e2d6;
		color: #1a1a1a;
		font-weight: 600;
		cursor: pointer;
	}
	:global(button:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}
	:global(button.primary) {
		background: #c8a04a;
	}
	:global(button.danger) {
		background: #f3dede;
		color: #b00020;
	}
	:global(.ok) {
		color: #137a3f;
		font-weight: 600;
	}
	:global(.err) {
		color: #b00020;
	}
	:global(.muted) {
		color: #777;
		font-size: 0.9rem;
	}
	:global(.badge) {
		padding: 0.12rem 0.5rem;
		border-radius: 99px;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: capitalize;
	}
	:global(.badge.draft) {
		background: #ece9e1;
		color: #6b6356;
	}
	:global(.badge.pending) {
		background: #fff0d6;
		color: #946200;
	}
	:global(.badge.publishing) {
		background: #dbeafe;
		color: #1e40af;
	}
	:global(.badge.published) {
		background: #d8f3e3;
		color: #137a3f;
	}
	:global(.badge.failed) {
		background: #f7d7d7;
		color: #b00020;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.8rem 1.5rem;
		background: #111;
		color: #fff;
		gap: 1rem;
	}
	.brand {
		font-weight: 700;
		letter-spacing: 0.5px;
		color: #fff;
		text-decoration: none;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.switcher select {
		padding: 0.35rem 0.6rem;
		border-radius: 6px;
		border: 1px solid #444;
		background: #1c1c1c;
		color: #fff;
		font-weight: 600;
		max-width: 16rem;
	}
	.nav {
		color: #ccc;
		text-decoration: none;
		font-size: 0.9rem;
	}
	.nav:hover {
		color: #fff;
	}
	header button {
		background: transparent;
		border: 1px solid #555;
		color: #ccc;
		padding: 0.3rem 0.7rem;
		border-radius: 6px;
		cursor: pointer;
	}
	.page {
		max-width: 60rem;
		margin: 0 auto;
		padding: 1.5rem;
	}
</style>
