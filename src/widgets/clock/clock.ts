/**
 * Clock contract (§1.2 N7, §11.3).
 *
 * The render path must be deterministic: identical stdin + config +
 * frozen clock ⇒ byte-identical bytes. Widgets MUST read the current
 * time through `ctx.clock`, never `Date.now()` directly. Golden tests
 * inject a `frozenClock(...)` so output is reproducible across hosts.
 */

export interface Clock {
  /** Return a fresh `Date` (UTC) representing "now". */
  now(): Date;
}

export const realClock: Clock = Object.freeze({
  now: () => new Date(),
});

export function frozenClock(at: Date | string | number): Clock {
  const fixed = at instanceof Date ? new Date(at.getTime()) : new Date(at);
  if (Number.isNaN(fixed.getTime())) {
    throw new Error(`agentline: frozenClock received an invalid date: ${String(at)}`);
  }
  return Object.freeze({
    now: () => new Date(fixed.getTime()),
  });
}
