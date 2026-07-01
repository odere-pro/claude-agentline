/**
 * `thinking-effort` widget (§7.2). One of `low` / `medium` / `high`
 * / `xhigh` / `max` / `ultracode`. Renders in the session family accent — no
 * per-widget colour, so every session widget reads as one family.
 *
 * `ultracode` is a maintainer-forced forward-compat tier: the host's
 * statusline does not currently emit it as a level — its ultracode
 * orchestration mode reports reasoning effort as `xhigh` — so it is
 * recognised here for the day the host exposes it. An unrecognised level
 * still passes through verbatim, so nothing is hidden either way; the only
 * effect of recognition is case-normalisation (e.g. `ULTRACODE` → `ultracode`).
 */

import type { Cell } from "../cell/cell.js";
import { defineWidget } from "../widget.js";

/**
 * Recognised effort levels — single source for both the `Effort` type and the
 * `normaliseEffort` guard (no hand-synced duplicate). The first five are the
 * host's reasoning tiers; `ultracode` is appended as a recognised forward-compat
 * value (the host reports `xhigh`, not a level above `max`, for ultracode mode),
 * so this list is a membership set, not a strict effort ranking.
 */
const EFFORT_TIERS = ["low", "medium", "high", "xhigh", "max", "ultracode"] as const;

type Effort = (typeof EFFORT_TIERS)[number];

interface ThinkingEffortOptions {
  readonly label?: string;
}

function normaliseEffort(value: string): Effort | null {
  const v = value.toLowerCase().trim();
  return (EFFORT_TIERS as readonly string[]).includes(v) ? (v as Effort) : null;
}

export const thinkingEffortWidget = defineWidget<ThinkingEffortOptions>(
  "thinking-effort",
  (ctx, settings): Cell => {
    const raw = ctx.session?.thinkingEffort ?? ctx.stdin.thinkingEffort;
    if (!raw) return { text: "", hidden: true };
    const effort = normaliseEffort(raw);
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${effort ?? raw}` };
  },
);
