import { defineConfig } from 'vite';

// D-BP155-006 / BISHOP / seg-shadow-fix
// vitest has no config of its own in this repo (confirmed: vitest's config
// discovery only matches vite.config.* / vitest.config.* filenames, and
// vite.renderer.config.ts does not match either pattern, so vitest was
// running with vite's unmodified DEFAULT_EXTENSIONS, which tries .js before
// .ts/.tsx). This file exists solely to pin resolve.extensions so a stale
// same-basename .js file can never shadow its .ts/.tsx sibling under
// `vitest run`. It intentionally sets nothing else, to avoid changing any
// other existing test behavior.
export default defineConfig({
  resolve: {
    extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
  },
});
