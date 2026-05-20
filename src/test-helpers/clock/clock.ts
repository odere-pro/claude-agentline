/**
 * Test-only re-export of the deterministic clock plus the canonical
 * frozen instant the shared factories pin by default.
 *
 * Widgets read time only through `ctx.clock` (§1.2 N7, §11.3). Test
 * authors who need a different instant pass `frozenClock(other)` into
 * `makeWidgetContext({ clock })` directly; the canonical value below is
 * only the default so unrelated tests agree on a shared baseline.
 */

import { frozenClock } from "../../widgets/clock/clock.js";

export { frozenClock, realClock, type Clock } from "../../widgets/clock/clock.js";

/**
 * Canonical frozen instant used by the shared test factories. Picked
 * because it is already the most common value across the existing
 * widget suites; tests that need a different point in time pass their
 * own `frozenClock(...)` instead of mutating this constant.
 */
export const CANONICAL_TEST_INSTANT = "2026-05-01T00:00:00Z" as const;

/** Convenience wrapper: a clock pinned at `CANONICAL_TEST_INSTANT`. */
export function canonicalClock() {
  return frozenClock(CANONICAL_TEST_INSTANT);
}
