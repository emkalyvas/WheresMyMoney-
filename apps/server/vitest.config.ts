import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { TZ: 'Europe/Athens' },
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});
