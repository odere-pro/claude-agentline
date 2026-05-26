/**
 * Shared test helpers for the agentline suite.
 *
 * Import factories, sandbox wrappers, and the deterministic clock from
 * this barrel; the underlying modules live in sub-folders to match the
 * repo's folder-per-feature convention. Only `*.test.ts` files may
 * import from here — enforced by ESLint (`no-restricted-imports`).
 */

export {
  CANONICAL_TEST_INSTANT,
  canonicalClock,
  frozenClock,
  realClock,
  type Clock,
} from "./clock/clock.js";

export {
  makeCell,
  makeGitSnapshot,
  makeStdinPayload,
  makeTokensSnapshot,
  makeTranscriptEvent,
  makeWidgetContext,
} from "./factories/factories.js";

export { rmrf, withSandbox, withTmpDir } from "./sandbox/sandbox.js";
