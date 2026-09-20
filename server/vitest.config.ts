import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node only — nothing under test touches a DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The engine is pure, so these never need a database. Anything that would
    // reach Postgres belongs in log.ts, which is deliberately not covered here.
    globals: false,
  },
})
