import { configDefaults, defineProject, mergeConfig } from 'vitest/config';

import core from './vitest.config';

// Instrumented tests run several times slower: the RANSAC property test takes seconds on CI.
// Stryker times out a mutant itself, from the dry run's times, so vitest's own limit only has to
// let the dry run finish.
const INSTRUMENTED_TEST_TIMEOUT = 60_000;

// What Stryker runs: the core's tests without the end-to-end ones, whose pixel loops take minutes
// under instrumentation and would turn every mutant they cover into a timeout.
export default mergeConfig(
  core,
  defineProject({
    test: {
      exclude: [...configDefaults.exclude, 'src/**/*.e2e.test.ts'],
      testTimeout: INSTRUMENTED_TEST_TIMEOUT,
    },
  }),
);
