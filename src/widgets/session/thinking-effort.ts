/**
 * `thinking-effort` widget (§7.2). One of `low` / `medium` / `high`
 * / `xhigh` / `max` / `ultracode`.
 *
 * By default it renders flat in the session family accent — no per-widget
 * colour, so every session widget reads as one family. The opt-in `emphasis`
 * variant instead colour-ramps by tier (via `Cell.signal`, which the widget
 * contract blesses for "effort level"), escalating to `success` at `max`;
 * `ultracode` gets its own signature purple (see ULTRACODE_COLOUR).
 *
 * `ultracode` is a maintainer-forced forward-compat tier: the host's
 * statusline does not currently emit it as a level — its ultracode
 * orchestration mode reports reasoning effort as `xhigh` — so it is
 * recognised here for the day the host exposes it. An unrecognised level
 * still passes through verbatim, so nothing is hidden either way; the only
 * effect of recognition is case-normalisation (e.g. `ULTRACODE` → `ultracode`).
 */

import { resolveRole, type ThemeRole } from "../../data/theme/index.js";
import type { Colour } from "../../data/theme/colours/colours.js";
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
  /** Opt-in tier colour ramp (the `emphasis` variant). Default renders flat. */
  readonly emphasis?: boolean;
}

function normaliseEffort(value: string): Effort | null {
  const v = value.toLowerCase().trim();
  return (EFFORT_TIERS as readonly string[]).includes(v) ? (v as Effort) : null;
}

/**
 * `ultracode`'s signature colour. It is a special orchestration mode, not a
 * normal reasoning tier (the host reports `xhigh` for it), so the emphasis
 * ramp gives it a distinct purple rather than folding it into the accent.
 * At truecolor this is a purple no semantic role in the default palette uses;
 * at low colour depths it down-samples toward magenta and the tier ramp can
 * collapse, but the tier name always stays in the text so meaning is never
 * colour-only, and it drops entirely under `--no-color`.
 *
 * Fixed (not a theme role) because the theme schema requires every theme to
 * define every role, so a one-off signature is not worth that surface. The
 * trade-off: a literal cannot adapt per background, so on a light theme this
 * purple has weak contrast — making it theme-aware is left as a follow-up
 * (the value is inert until the host emits `ultracode` at all).
 */
export const ULTRACODE_COLOUR: Colour = "#bb9af7";

/**
 * Emphasis ramp: each reasoning tier maps to a theme role, escalating to
 * `success` (premium / most-capable) at `max` rather than a warning hue.
 * `ultracode` is handled separately (see ULTRACODE_COLOUR).
 */
const TIER_ROLE: Readonly<Record<Exclude<Effort, "ultracode">, ThemeRole>> = Object.freeze({
  low: "muted",
  medium: "info",
  high: "accent",
  xhigh: "accent",
  max: "success",
});

export const thinkingEffortWidget = defineWidget<ThinkingEffortOptions>(
  "thinking-effort",
  (ctx, settings): Cell => {
    const raw = ctx.session?.thinkingEffort ?? ctx.stdin.thinkingEffort;
    if (!raw) return { text: "", hidden: true };
    const effort = normaliseEffort(raw);
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    const text = `${label}${effort ?? raw}`;
    // Emphasis only colours a *recognised* tier; an unknown level renders flat.
    if (settings.options.emphasis && effort) {
      const fg: Colour =
        effort === "ultracode" ? ULTRACODE_COLOUR : resolveRole(ctx.theme, TIER_ROLE[effort]);
      return { text, fg, signal: true };
    }
    return { text };
  },
);
