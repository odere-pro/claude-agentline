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
 * Host-provided next-reset instant for `window`, in epoch *milliseconds*,
 * or `undefined` when the host did not ship that window's `resets_at`
 * (the caller then uses its local fallback). `resets_at` is epoch
 * *seconds* on the wire (`src/stdin/index.ts:91`), so this multiplies by
 * 1000. The explicit finite check keeps the helper safe for the
 * direct-`adaptStatuslinePayload` and hand-built-context seams.
 */
export function hostResetMs(ctx: WidgetContext, window: ResetWindow): number | undefined {
  const limits = ctx.stdin.rateLimits;
  const win = window === "five-hour" ? limits?.fiveHour : limits?.sevenDay;
  const resetsAt = win?.resetsAt;
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt)) return undefined;
  return resetsAt * 1000;
}
