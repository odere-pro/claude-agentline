/**
 * Shared helper for the `context-*` widgets: resolve `{ used, window }`
 * for the current prompt.
 *
 * Source of truth, in priority order:
 *
 *   1. Claude Code's `context_window.current_usage` — `input_tokens +
 *      cache_read_input_tokens + cache_creation_input_tokens`, divided
 *      by `context_window_size`. This is what the user sees in
 *      Claude Code's own UI (`used_percentage`), so the widget agrees
 *      with the host.
 *   2. The local transcript-derived `TokensSnapshot.events` aggregated
 *      across the session. Legacy path for hosts that don't ship
 *      `context_window` on stdin (older Claude Code, golden fixtures);
 *      it OVER-counts because it sums every prompt's input rather than
 *      the current turn's window — that's exactly why live renders used
 *      to display "999%" on a long session. Kept only as a fallback.
 */

import { aggregate } from "../../data/tokens/index.js";
import type { WidgetContext } from "../types.js";
import { formatCount } from "../tokens/format/format.js";

const SYNTHETIC_DEFAULT_WINDOW = 100;

/**
 * Floor below which a window value is the synthetic fallback
 * (`SYNTHETIC_DEFAULT_WINDOW`), not a real model window. The
 * `context-*` widgets skip the window-size postfix below this so they
 * never render a bogus tiny number.
 */
export const MIN_WINDOW_FOR_POSTFIX = 1000;

/**
 * Format a context-window size for the widget postfix (e.g. `200k`,
 * `1M`). Returns `null` when the window is the synthetic fallback so
 * callers omit the postfix entirely.
 */
export function formatWindowLabel(window: number): string | null {
  return window >= MIN_WINDOW_FOR_POSTFIX ? formatCount(window) : null;
}

/**
 * Resolve the cached-token count for the current session — the same cache
 * source `context-percentage`'s usage path counts (the transcript
 * `TokensSnapshot` aggregated over the session). Returns `null` when no
 * snapshot is available or the session has no cached tokens. Used by the
 * `context-cached` widget and `context-percentage`'s `showCached` postfix.
 *
 * The live `context_window` block sums cache reads/writes into a single
 * `usedTokens` and never reports the cached portion separately, so the
 * cached figure is necessarily the transcript-derived one — the same
 * value `tokens-cached` shows.
 */
export function resolveCachedTokens(ctx: WidgetContext): number | null {
  const snapshot = ctx.tokens;
  if (!snapshot) return null;
  const totals = aggregate({
    events: snapshot.events,
    axis: "session",
    now: snapshot.now,
    sessionStart: snapshot.sessionStart,
    model: ctx.stdin.model,
    effort: ctx.stdin.thinkingEffort,
  });
  return totals.cached > 0 ? totals.cached : null;
}

export function resolveContextUsage(ctx: WidgetContext): { used: number; window: number } | null {
  const live = ctx.stdin.contextWindow;
  if (live?.usedTokens !== undefined && live.usedTokens > 0) {
    const window =
      live.windowSize !== undefined && live.windowSize > 0
        ? live.windowSize
        : (ctx.tokens?.contextWindow ?? 0);
    if (window > 0) return { used: live.usedTokens, window };
  }
  if (live?.usedPercentage !== undefined && live.usedPercentage >= 0) {
    /*
     * Synthesize a `{used, window}` pair from Claude Code's pre-computed
     * ratio so `context-percentage` still produces a meaningful number
     * when the host doesn't report a window size. The synthetic window
     * is below `MIN_WINDOW_FOR_POSTFIX`, so the size postfix is omitted
     * rather than showing a bogus tiny number.
     */
    const window =
      live.windowSize !== undefined && live.windowSize > 0
        ? live.windowSize
        : (ctx.tokens?.contextWindow ?? SYNTHETIC_DEFAULT_WINDOW);
    return { used: (live.usedPercentage / 100) * window, window };
  }
  const snapshot = ctx.tokens;
  if (!snapshot) return null;
  const totals = aggregate({
    events: snapshot.events,
    axis: "session",
    now: snapshot.now,
    sessionStart: snapshot.sessionStart,
    model: ctx.stdin.model,
    effort: ctx.stdin.thinkingEffort,
  });
  return { used: totals.input + totals.cached, window: snapshot.contextWindow };
}
