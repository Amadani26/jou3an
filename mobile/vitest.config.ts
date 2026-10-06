import { defineConfig } from 'vitest/config'

/**
 * Pure-logic tests only.
 *
 * ⚠️ Scoped to `lib/**` on purpose. Nothing here renders a React Native tree:
 * doing that would drag in Reanimated, gesture-handler, expo-router and the
 * native module shims, which is a large amount of mocking to assert a rule that
 * is better expressed as a pure function in the first place. Anything about the
 * screens that is worth protecting gets extracted into lib/ and tested here —
 * see lib/resultsFlow.ts.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    globals: false,
  },
})
