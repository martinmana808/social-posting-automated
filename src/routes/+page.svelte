<script lang="ts">
	import { enhance } from '$app/forms';
	import PostCard from '$lib/components/PostCard.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>Social Posting</title></svelte:head>

{#if !data.client}
	<div class="empty">
		<h1>No clients yet</h1>
		<p class="muted">Add your first client to start scheduling posts.</p>
		<a href="/admin/clients" class="cta">Go to Clients →</a>
	</div>
{:else}
	<div class="head">
		<div>
			<h1>{data.client.name}</h1>
			<p class="muted">
				{data.client.timezone}
				{#if !data.client.connected}· <span class="warn">not connected — set credentials in Clients</span>{/if}
			</p>
		</div>
		<form method="POST" action="?/createDraft" use:enhance>
			<button class="primary">+ New post</button>
		</form>
	</div>

	<details class="help">
		<summary>How posting works</summary>
		<ol>
			<li><b>Pick the client</b> in the top-bar switcher — everything below is only theirs.</li>
			<li><b>Add content:</b> click <b>+ New post</b> to upload finished images (drag to reorder for a
				carousel), write the caption, and set the date/time in <b>{data.client.timezone}</b>. Or paste a
				CSV under “Add posts from CSV”.</li>
			<li>Posts sit as <b>pending</b> until their scheduled time. A background job publishes anything
				due <b>every 15 minutes</b> to the client's Facebook + Instagram.</li>
			<li>To publish immediately, hit <b>Publish anything due now</b> (or <b>Publish now</b> on a card).</li>
		</ol>
		<p class="muted small">
			Each post goes to <b>both</b> Facebook and Instagram. Failures show a red status with the reason
			and are retried automatically. Manage a client's connection under <a href="/admin/clients">Clients</a>.
		</p>
	</details>

	<section class="stats">
		<span><b>{data.stats?.draft}</b> draft</span>
		<span><b>{data.stats?.pending}</b> pending</span>
		<span><b>{data.stats?.published}</b> published</span>
		<span class:bad={(data.stats?.failed ?? 0) > 0}><b>{data.stats?.failed}</b> failed</span>
		<form method="POST" action="?/runDue" use:enhance>
			<button class="primary">Publish anything due now</button>
		</form>
	</section>

	{#if form?.dispatched === 'background' || form?.dispatchedOne === 'background'}
		<p class="ok">Publishing in the background (carousels take ~1 min). Refresh shortly to see status update.</p>
	{:else if form?.dispatched === 'inline' || form?.dispatchedOne === 'inline'}
		<p class="ok">Done.</p>
	{/if}
	{#if form?.error}<p class="err">{form.error}</p>{/if}

	<details class="ingest" open={data.posts.length === 0}>
		<summary>Add posts from CSV</summary>
		<p class="muted">Columns: <code>image, title, blurb, hashtags, date</code> — date is
			<code>YYYY-MM-DD</code> or <code>YYYY-MM-DD HH:MM</code> (in <b>{data.client.timezone}</b>,
			24-hour; defaults to 09:00). Image must be a public HTTPS URL (pipe-separate for a carousel).</p>
		<form method="POST" action="?/ingest" use:enhance>
			<textarea
				name="csv"
				rows="7"
				placeholder="image,title,blurb,hashtags,date
https://.../photo.jpg,New arrival,In store now,#brand #newin,2026-09-01 10:00"
			></textarea>
			<button type="submit">Ingest CSV</button>
			{#if form?.ingested}<span class="ok">✓ Added {form.ingested} posts.</span>{/if}
		</form>
	</details>

	<div class="feed">
		{#each data.posts as p (p.id)}
			<PostCard post={p} timezone={data.client.timezone} startEditing={form?.createdId === p.id} />
		{/each}
		{#if data.posts.length === 0}
			<p class="muted center">No posts yet — add one above or hit “+ New post”.</p>
		{/if}
	</div>
{/if}

<style>
	.empty {
		text-align: center;
		margin-top: 4rem;
	}
	.cta {
		display: inline-block;
		margin-top: 0.5rem;
		background: #c8a04a;
		color: #1a1a1a;
		padding: 0.55rem 1rem;
		border-radius: 6px;
		font-weight: 700;
		text-decoration: none;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.head h1 {
		margin: 0 0 0.2rem;
	}
	.help {
		background: #fbf7ec;
		border: 1px solid #ecdfc0;
		border-radius: 10px;
		padding: 0.8rem 1.1rem;
		margin: 1rem 0;
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
	.small {
		font-size: 0.78rem;
	}
	.warn {
		color: #946200;
		font-weight: 600;
	}
	.stats {
		display: flex;
		gap: 1.5rem;
		align-items: center;
		margin: 1rem 0;
	}
	.stats .bad b {
		color: #b00020;
	}
	.stats form {
		margin-left: auto;
	}
	.ingest {
		background: #fff;
		border-radius: 10px;
		padding: 1rem 1.2rem;
		margin: 1rem 0 1.5rem;
	}
	code {
		background: #eee;
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		font-family: monospace;
		font-size: 0.85rem;
		padding: 0.6rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		margin: 0.5rem 0;
	}
	.feed {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.center {
		text-align: center;
	}
</style>
