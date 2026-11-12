import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['engine/**/*.ts', 'electron/main/**/*.ts', 'shared/**/*.ts'],
      exclude: ['**/*.d.ts', 'electron/main/main.ts', 'electron/main/window.ts'],
      thresholds: {
        lines: 45,
        functions: 45,
        branches: 35,
        statements: 45,
      },
    },
  },
});
