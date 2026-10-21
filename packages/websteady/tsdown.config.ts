import { defineConfig } from 'tsdown';

// One ESM entry and its declarations; the core and the adapter are workspace packages, bundled in.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'browser',
  target: 'es2023',
  dts: { eager: true },
  deps: { alwaysBundle: [/^@websteady\//] },
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
