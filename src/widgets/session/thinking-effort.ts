/**
 * `thinking-effort` widget (§7.2). One of `low` / `medium` / `high`
 * / `xhigh` / `max` / `ultracode`.
 *
 * By default it renders flat in the session family accent — no per-widget
 * colour, so every session widget reads as one family. The opt-in `emphasis`
 * variant instead colour-ramps by tier (via `Cell.signal`, which the widget
 * contract blesses for "effort level"), escalating to `success` at `max`;
 * `ultracode` gets its own signature colour via the `effort-ultracode` theme
 * role, so each theme can pick a value readable on its background.
 *
 * The host's statusline does not emit `ultracode` as a level — its ultracode
 * orchestration mode reports reasoning effort as `xhigh`, indistinguishable
 * from a plain `xhigh` session. The `assumeUltracode` option bridges that: a
 * recognised `xhigh` is surfaced as `ultracode`. It defaults **on**
 * (issue #295) — an opt-*out*, not an opt-in — so both fresh installs and
 * existing frozen configs show `ultracode` on the next render without any
 * config edit; set `assumeUltracode: false` to keep a raw `xhigh` as `xhigh`.
 * When the host ever emits a real `ultracode` level it is honoured directly,
 * regardless of the flag.
 *
 * `ultracode` is a signature mode: it always renders in its own
 * `effort-ultracode` theme colour (a single violet, identical across shipped
 * themes, matching the host CLI's ultracode hue), independent of the
 * `emphasis` variant — so it stays visible and noticeable. An unrecognised
 * level still
 * passes through verbatim; the only effect of recognition is
 * case-normalisation (e.g. `ULTRACODE` → `ultracode`).
 */

import { resolveRole, type ThemeRole } from "../../data/theme/index.js";
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
  /**
   * Surface ultracode. The host reports ultracode mode as `xhigh` (no distinct
   * level), so a recognised `xhigh` renders as `ultracode` in its signature
   * violet. **On by default** (issue #295) — set to `false` to keep a raw
   * `xhigh` as `xhigh` (a plain-`xhigh`, non-ultracode session opts out here).
   */
  readonly assumeUltracode?: boolean;
}

function normaliseEffort(value: string): Effort | null {
  const v = value.toLowerCase().trim();
  return (EFFORT_TIERS as readonly string[]).includes(v) ? (v as Effort) : null;
}

/**
 * Emphasis ramp: each reasoning tier maps to a theme role, escalating to
 * `success` (premium / most-capable) at `max` rather than a warning hue.
 * `ultracode` is a special orchestration mode, not a normal reasoning tier
 * (the host reports `xhigh` for it), so it resolves through its own
 * `effort-ultracode` theme role rather than this ramp — giving it a distinct
 * signature colour each theme can tune for contrast. The tier name always
 * stays in the text so meaning is never colour-only, and colour drops
 * entirely under `--no-color`. (The value is inert until the host emits
 * `ultracode` at all — today ultracode reports as `xhigh`.)
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
    let effort = normaliseEffort(raw);
    // The host collapses ultracode mode to `xhigh`. Surface it as `ultracode`
    // by default (issue #295); only an explicit `assumeUltracode: false` opts
    // out, so both new installs and existing frozen configs relabel on the
    // next render without a config edit.
    if (settings.options.assumeUltracode !== false && effort === "xhigh") {
      effort = "ultracode";
    }
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    const text = `${label}${effort ?? raw}`;
    // ultracode is a signature mode: always its own violet + signal, so it
    // stays visible regardless of the emphasis variant.
    if (effort === "ultracode") {
      return { text, fg: resolveRole(ctx.theme, "effort-ultracode"), signal: true };
    }
    // Emphasis only colours a *recognised* tier; an unknown level renders flat.
    if (settings.options.emphasis && effort) {
      return { text, fg: resolveRole(ctx.theme, TIER_ROLE[effort]), signal: true };
    }
    return { text };
  },
);
