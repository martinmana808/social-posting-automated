<script lang="ts">
	let { form } = $props();
</script>

<svelte:head><title>Social Posting — login</title></svelte:head>

<main class="card">
	<h1>Social Posting</h1>
	<form method="POST">
		<!-- svelte-ignore a11y_autofocus -->
		<input type="password" name="password" placeholder="Admin password" required autofocus />
		{#if form?.error}<p class="err">{form.error}</p>{/if}
		<button type="submit">Sign in</button>
	</form>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
		background: #111;
		color: #eee;
	}
	.card {
		max-width: 22rem;
		margin: 6rem auto;
		padding: 2rem;
		background: #1d1d1d;
		border-radius: 12px;
		text-align: center;
	}
	input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.7rem;
		margin: 0.5rem 0;
		border: 1px solid #444;
		border-radius: 6px;
		background: #111;
		color: #eee;
	}
	button {
		width: 100%;
		padding: 0.7rem;
		background: #c8a04a;
		color: #111;
		border: 0;
		border-radius: 6px;
		font-weight: 700;
		cursor: pointer;
	}
	.err {
		color: #ff7676;
		font-size: 0.85rem;
	}
</style>
