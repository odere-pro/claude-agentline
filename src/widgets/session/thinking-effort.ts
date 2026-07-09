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
 * Ultracode is **not representable** in the statusline payload. The host keeps
 * `ultracode` as a separate boolean in app state and never serialises it, so
 * `/effort xhigh` and `/effort ultracode` produce byte-identical payloads. Nor
 * is `effort.level` a mirror of the session's `/effort` selection: the host
 * resolves it through a launch-effort pin (active for opus-4-7 / opus-4-8 /
 * fable-5, which report the model's `default_effort`), a `CLAUDE_CODE_EFFORT_LEVEL`
 * override, and an xhigh→high downgrade on models lacking the capability. So an
 * ultracode session on Opus 4.8 reports `high`, and a plain xhigh session
 * reports `xhigh`.
 *
 * `assumeUltracode` therefore cannot detect ultracode — it only relabels a
 * recognised `xhigh`, guessing wrong in both directions. It is an opt-in display
 * preference, **off by default** (issue #303 reverts the #295 default-on flip).
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
   * Relabel a recognised `xhigh` as `ultracode` in its signature violet. This
   * is a display preference, not detection — the payload carries no ultracode
   * signal (see the module docstring). **Off by default**; set to `true` if you
   * run ultracode and accept that a plain `xhigh` session also relabels.
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
 * `ultracode` is a special orchestration mode, not a normal reasoning tier, so
 * it resolves through its own `effort-ultracode` theme role rather than this
 * ramp — giving it a distinct signature colour each theme can tune for
 * contrast. The tier name always stays in the text so meaning is never
 * colour-only, and colour drops entirely under `--no-color`. (The ramp is only
 * reachable for `ultracode` via the opt-in relabel; the host emits no such
 * level today.)
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
    // Opt-in only: `xhigh` does not imply ultracode, and ultracode does not
    // imply a reported `xhigh` (issue #303). Guess only when asked to.
    if (settings.options.assumeUltracode === true && effort === "xhigh") {
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
