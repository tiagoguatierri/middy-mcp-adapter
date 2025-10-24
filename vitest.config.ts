import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      thresholds: {
        lines: 77, // increase this to 80
        functions: 65, // increase this to 80
        statements: 77, // increase this to 80
        branches: 55 // increase this to 80
      }
    }
  }
})
