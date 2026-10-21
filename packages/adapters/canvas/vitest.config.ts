import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'canvas',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
