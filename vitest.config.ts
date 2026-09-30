/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/**
 * The pure game modules (save, news, prices) need nothing but Node, but the
 * town menu is a React tree and has to be mounted to be worth asserting on, so
 * the component suites opt into jsdom with a per-file `@vitest-environment`
 * docblock. The tailwind and singlefile plugins in vite.config.ts exist for the
 * shipping build and would only slow the runner down here.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    reporters: 'dot',
  },
});
