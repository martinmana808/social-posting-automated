<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Post } from '$lib/types';
	import { parseSlides } from '$lib/slides';
	import { utcToZonedInput } from '$lib/datetime';

	let {
		post,
		timezone = 'Pacific/Auckland',
		startEditing = false
	}: { post: Post; timezone?: string; startEditing?: boolean } = $props();

	// Short label for the client's timezone, e.g. "NZST", "GMT-3".
	const tzLabel = $derived(
		new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'short' })
			.formatToParts(new Date())
			.find((p) => p.type === 'timeZoneName')?.value ?? timezone
	);
	const editable = $derived(post.status === 'draft' || post.status === 'pending');

	// View mode reads straight from the prop; edit mode works on a local buffer.
	const viewSlides = $derived(parseSlides(post.image_url));

	let editing = $state(false);
	let slides = $state<string[]>([]); // edit buffer
	let caption = $state('');
	let scheduledLocal = $state('');
	let uploading = $state(0);
	let uploadError = $state('');
	let dragIndex = $state<number | null>(null);

	const headerSlides = $derived(editing ? slides : viewSlides);

	// Open straight into edit mode for a freshly created draft.
	$effect(() => {
		if (startEditing && !editing) startEdit();
	});

	const fmt = (iso: string, tz: string) =>
		new Date(iso).toLocaleString('en-GB', {
			timeZone: tz,
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});

	function startEdit() {
		slides = parseSlides(post.image_url);
		caption = post.caption;
		scheduledLocal = utcToZonedInput(post.scheduled_at, timezone);
		uploadError = '';
		editing = true;
	}

	function removeSlide(i: number) {
		slides = slides.filter((_, idx) => idx !== i);
	}

	function onDrop(target: number) {
		if (dragIndex === null || dragIndex === target) {
			dragIndex = null;
			return;
		}
		const next = [...slides];
		const [moved] = next.splice(dragIndex, 1);
		next.splice(target, 0, moved);
		slides = next;
		dragIndex = null;
	}

	async function onFiles(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		uploadError = '';
		for (const file of files) {
			uploading++;
			try {
				const res = await fetch('/api/upload-url', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ filename: file.name })
				});
				if (!res.ok) throw new Error((await res.text()) || 'Could not get an upload URL');
				const { signedUrl, publicUrl } = await res.json();
				const put = await fetch(signedUrl, {
					method: 'PUT',
					headers: { 'content-type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
					body: file
				});
				if (!put.ok) throw new Error(`Upload failed for ${file.name}`);
				slides = [...slides, publicUrl];
			} catch (err) {
				uploadError = err instanceof Error ? err.message : 'Upload failed';
			} finally {
				uploading--;
			}
		}
	}

	const canSave = $derived(uploading === 0 && slides.length > 0 && !!scheduledLocal);
</script>

<article class="card">
	<header>
		<div class="times">
			<div class="nzt">{fmt(post.scheduled_at, timezone)} <span class="tz">{tzLabel}</span></div>
		</div>
		<div class="meta">
			<span class="count">{headerSlides.length} {headerSlides.length === 1 ? 'slide' : 'slides'}</span>
			<span class="badge {post.status}">{post.status}</span>
		</div>
	</header>

	{#if editing}
		<div class="strip edit">
			{#each slides as src, i (src + i)}
				<figure
					draggable="true"
					class:dragging={dragIndex === i}
					ondragstart={() => (dragIndex = i)}
					ondragover={(e) => e.preventDefault()}
					ondrop={() => onDrop(i)}
					ondragend={() => (dragIndex = null)}
				>
					<img {src} alt="" loading="lazy" />
					<button type="button" class="x" title="Remove slide" onclick={() => removeSlide(i)}>✕</button>
					<figcaption>{i + 1}</figcaption>
				</figure>
			{/each}
			<label class="add" title="Add image(s)">
				<input type="file" accept="image/*" multiple onchange={onFiles} hidden />
				<span>{uploading > 0 ? `Uploading… (${uploading})` : '+ Add image'}</span>
			</label>
		</div>
		{#if slides.length > 1}<p class="hint">Drag slides to reorder · slide 1 is the cover.</p>{/if}
		{#if uploadError}<p class="err small">{uploadError}</p>{/if}

		<form
			method="POST"
			action="?/updatePost"
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'success') editing = false;
					await update();
				}}
		>
			<input type="hidden" name="id" value={post.id} />
			<input type="hidden" name="images" value={JSON.stringify(slides)} />
			<label class="field">
				<span>Caption</span>
				<textarea name="caption" rows="5" bind:value={caption}></textarea>
			</label>
			<label class="field when">
				<span>Publish ({timezone})</span>
				<input type="datetime-local" name="scheduled_local" bind:value={scheduledLocal} />
			</label>
			<div class="editactions">
				<button type="submit" class="primary" disabled={!canSave}>Save</button>
				<button type="button" onclick={() => (editing = false)}>Cancel</button>
			</div>
		</form>
	{:else}
		<div class="strip">
			{#each viewSlides as src, i (src + i)}
				<figure>
					<img {src} alt="" loading="lazy" />
					<figcaption>{i + 1}</figcaption>
				</figure>
			{/each}
			{#if viewSlides.length === 0}<p class="muted">No images yet.</p>{/if}
		</div>

		<p class="caption">{post.caption}</p>
		{#if post.last_error}<div class="err small">{post.last_error}</div>{/if}

		<footer class="actions">
			{#if editable}
				<button type="button" onclick={startEdit}>Edit</button>
			{/if}
			{#if post.status !== 'published'}
				<form method="POST" action="?/publishOne" use:enhance>
					<input type="hidden" name="id" value={post.id} />
					<button title="Publish this now">Publish now</button>
				</form>
			{/if}
			{#if post.fb_post_id}
				<a class="link" href="https://www.facebook.com/{post.fb_post_id}" target="_blank" rel="noreferrer">View on FB ↗</a>
			{/if}
			<form method="POST" action="?/remove" use:enhance>
				<input type="hidden" name="id" value={post.id} />
				<button class="danger">Delete</button>
			</form>
		</footer>
	{/if}
</article>

<style>
	.card {
		background: #fff;
		border-radius: 10px;
		padding: 1rem 1.2rem 1.2rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}
	.card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}
	.times {
		font-size: 0.9rem;
	}
	.times .nzt {
		font-weight: 700;
		color: #1a1a1a;
	}
	.tz {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: #b08a3a;
		margin-left: 0.2rem;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		white-space: nowrap;
	}
	.count {
		font-size: 0.75rem;
		color: #999;
	}

	.strip {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.4rem;
		align-items: center;
	}
	.strip figure {
		position: relative;
		margin: 0;
		flex: 0 0 auto;
	}
	.strip img {
		height: 200px;
		width: auto;
		max-width: 220px;
		object-fit: cover;
		border-radius: 8px;
		background: #eee;
		display: block;
	}
	.strip figcaption {
		position: absolute;
		top: 6px;
		left: 6px;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		font-size: 0.7rem;
		font-weight: 700;
		width: 1.2rem;
		height: 1.2rem;
		border-radius: 4px;
		display: grid;
		place-items: center;
	}
	.strip.edit figure {
		cursor: grab;
	}
	.strip.edit figure.dragging {
		opacity: 0.4;
	}
	.strip .x {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 1.4rem;
		height: 1.4rem;
		padding: 0;
		border-radius: 50%;
		background: rgba(176, 0, 32, 0.9);
		color: #fff;
		font-size: 0.8rem;
		line-height: 1;
		display: grid;
		place-items: center;
	}
	.add {
		flex: 0 0 auto;
		height: 200px;
		width: 160px;
		border: 2px dashed #cbb98a;
		border-radius: 8px;
		display: grid;
		place-items: center;
		text-align: center;
		color: #8a7a4a;
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.hint {
		font-size: 0.75rem;
		color: #999;
		margin: 0.2rem 0 0;
	}

	.caption {
		white-space: pre-wrap;
		font-size: 0.86rem;
		line-height: 1.45;
		margin: 0.8rem 0 0;
	}

	.field {
		display: block;
		margin: 0.8rem 0 0;
	}
	.field > span {
		display: block;
		font-size: 0.75rem;
		font-weight: 700;
		color: #777;
		margin-bottom: 0.25rem;
	}
	.field textarea {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
		font-size: 0.86rem;
		line-height: 1.45;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		resize: vertical;
	}
	.field.when input {
		font: inherit;
		padding: 0.4rem 0.5rem;
		border: 1px solid #ccc;
		border-radius: 6px;
	}

	.actions,
	.editactions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.9rem;
	}
	.link {
		font-size: 0.82rem;
		color: #1e40af;
		text-decoration: none;
		font-weight: 600;
	}
	.small {
		font-size: 0.72rem;
		margin-top: 0.4rem;
	}
</style>
