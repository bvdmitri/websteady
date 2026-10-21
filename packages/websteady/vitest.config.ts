import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'websteady',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
