import { configDefaults, defineProject, mergeConfig } from 'vitest/config';

import core from './vitest.config';

// What Stryker runs: the core's tests without the end-to-end ones, whose pixel loops take minutes
// under instrumentation and would turn every mutant they cover into a timeout.
export default mergeConfig(
  core,
  defineProject({
    test: {
      exclude: [...configDefaults.exclude, 'src/**/*.e2e.test.ts'],
    },
  }),
);
