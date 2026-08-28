// Test config without the SvelteKit plugin (it fights Vitest's server).
// We alias the one virtual module our server code touches to a process.env stub.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'$env/dynamic/private': r('./src/test-stubs/env.ts'),
			$lib: r('./src/lib')
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node',
		setupFiles: ['./vitest.setup.ts']
	}
});
