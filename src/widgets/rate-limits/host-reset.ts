/**
 * Host-sourced reset moment for a rate-limit window (§7.5).
 *
 * The `rate_limits` block off Claude Code stdin carries the
 * authoritative next-reset instant per window as `resets_at` (Unix
 * epoch *seconds*). The reset-timer / reset-at widgets prefer this so
 * they agree with the host's `/usage` screen; they fall back to the
 * local block/week
 * derivation only when the host omits the window (older Claude Code,
 * golden fixtures without `rate_limits`). Mirrors `usage.ts`'s
 * host-first philosophy — except reset widgets fall back instead of
 * hiding, because the renderer is still useful with no transcript.
 */

import type { WidgetContext } from "../types.js";

/** Which `rate_limits` window a reset widget reads. */
export type ResetWindow = "five-hour" | "seven-day";

/**
 * Largest epoch-ms a JS `Date` can represent (±8.64e15). A `resets_at`
 * beyond this is either a finite overflow (`1e290 * 1000`) or simply out
 * of `Date` range; either way `new Date(ms)` is Invalid and the
 * wall-clock path throws, while the countdown path prints scientific
 * notation. We reject it here so callers fall back to the always-valid
 * local anchor.
 */
const MAX_DATE_MS = 8_640_000_000_000_000;

/**
 * Host-provided next-reset instant for `window`, in epoch *milliseconds*,
 * or `undefined` when the host did not ship a usable `resets_at` for that
 * window (the caller then uses its local fallback). `resets_at` is epoch
 * *seconds* on the wire (`src/stdin/index.ts:91`), so this multiplies by
 * 1000. The explicit finite check keeps the helper safe for the
 * direct-`adaptStatuslinePayload` and hand-built-context seams.
 *
 * An **elapsed** `resets_at` (at or before `now`) is rejected too (issue
 * #307). The host refreshes `rate_limits` on API activity, not on a timer,
 * so around a window rollover — or during a long idle — it keeps shipping
 * the reset instant that has already passed. Subtracting it from `now`
 * yields a negative remaining that `formatDuration` clamps to `0m`, and the
 * widget then prints a confident "reset in 0m" indefinitely. Observed live
 * as `reset in 0m · weekly 6d 23h 9m`, where the weekly window was healthy.
 * Treating it as absent lets the caller's local block/week derivation supply
 * a forward-looking answer.
 */
export function hostResetMs(ctx: WidgetContext, window: ResetWindow): number | undefined {
  const limits = ctx.stdin.rateLimits;
  const win = window === "five-hour" ? limits?.fiveHour : limits?.sevenDay;
  const resetsAt = win?.resetsAt;
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt)) return undefined;
  const ms = resetsAt * 1000;
  if (!Number.isFinite(ms) || Math.abs(ms) > MAX_DATE_MS) return undefined;
  if (ms <= ctx.clock.now().getTime()) return undefined;
  return ms;
}
