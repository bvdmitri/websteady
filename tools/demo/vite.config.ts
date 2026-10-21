// The demo page, with the library from its source.
import path from 'node:path';

import { defineConfig } from 'vite';

const ROOT = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  resolve: {
    alias: { '@bvdmitri/websteady': path.join(ROOT, 'packages/websteady/src/index.ts') },
  },
  worker: { format: 'es' },
});
