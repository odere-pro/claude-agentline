/**
 * Catalogue-adjacent widget option spec — the source of truth for which
 * `options` keys each widget accepts and which values are in range.
 *
 * Mutation commands (`config widget add --options …`, `config widget
 * set-option …`) validate against this before writing, so a typo
 * (`set-option notakey foo`) or an out-of-range value (`--options
 * '{"reset":"bad"}'`) is rejected with a helpful, catalogue-pointing
 * message and a non-zero exit, instead of being silently coerced at render
 * time. The render path itself stays forgiving (a bad value falls back),
 * but the *authoring* surface is strict.
 *
 * Strict per-widget (F-A part 1): EVERY shipped widget enumerates its full
 * known option-key set below — the set was audited against every
 * `settings.options.*` read in the widget sources. An unknown key is
 * rejected for ANY widget (not just variant-driven ones). `label` is
 * universal (every widget reads `settings.options.label`); `reset` is
 * implicit on the reset-bearing token accumulators. A widget with no entry
 * here (only a future widget the author forgot — `option-spec.test.ts`
 * fails on that) still accepts any key.
 */

import { RESET_AXES, type ResetAxis } from "../../../data/tokens/index.js";

/** A single option's contract: allowed value set, or free (any value). */
interface OptionRule {
  /** Allowed string values; omit for a free-form value (e.g. a label). */
  readonly values?: readonly string[];
}

/** Per-widget known option keys → value rule. */
interface WidgetOptionSpec {
  readonly [key: string]: OptionRule;
}

const RESET_RULE: OptionRule = { values: RESET_AXES as readonly ResetAxis[] };

/** The universal option every widget accepts. */
const UNIVERSAL_KEYS: ReadonlySet<string> = new Set(["label"]);

/**
 * Widgets that take a `reset` axis (the token accumulators). The axis is
 * validated against `RESET_AXES`; `reset` is implicit (not re-listed in
 * `WIDGET_OPTIONS`) for these.
 *
 * `tokens-cached` is absent by design (issue #306): it reports the cached
 * portion of the current context window, a point-in-time gauge, so there is
 * no window to aggregate over.
 */
const RESET_WIDGETS: ReadonlySet<string> = new Set(["tokens"]);

/** A free-form-but-known option (any value accepted; the KEY is known). */
const FREE: OptionRule = {};

/**
 * Known option keys/values per widget type — the full audited set. Every
 * registered widget appears here (enforced by `option-spec.test.ts`). A
 * key with no `values` accepts any value (the key is known; value-shape is
 * the widget's own concern). `label` is added universally at lookup; the
 * token accumulators' `reset` axis is handled separately.
 */
const WIDGET_OPTIONS: Readonly<Record<string, WidgetOptionSpec>> = Object.freeze({
  // ── session ──────────────────────────────────────────────────────────
  model: {},
  version: {},
  "thinking-effort": { emphasis: FREE, assumeUltracode: FREE },
  "thinking-enabled": { showOff: FREE },
  plan: {},
  project: {},
  "project-dir": { full: FREE },
  "cwd-path": { maxLength: FREE },
  "added-dirs": {},
  "agent-name": {},
  clock: { format: { values: ["24h", "12h"] }, seconds: FREE },
  "output-style": { showDefault: FREE },
  "vim-mode": {},
  "session-id": { length: FREE },
  "account-email": { mask: { values: ["none", "domain", "localpart"] } },
  "session-duration": {},
  "lines-changed": {},
  // ── tokens (cost block: host scalars, no reset axis) ─────────────────
  tokens: { inputGlyph: FREE, outputGlyph: FREE },
  "tokens-cached": {},
  "token-speed": { windowSec: FREE, inputGlyph: FREE, outputGlyph: FREE },
  "cost-usd": {},
  "cost-burn-rate": {},
  "api-duration": { percent: FREE },
  "cost-efficiency": {},
  "cost-vs-limit": { budget: FREE },
  // ── context ──────────────────────────────────────────────────────────
  "context-percentage": { showCached: FREE },
  "context-200k-flag": {},
  "context-cached": {},
  // ── rate-limits ──────────────────────────────────────────────────────
  "session-weekly-usage": { plan: FREE },
  "reset-timer": { format: FREE, resetHour: FREE, resetWeekday: FREE, tz: FREE },
  // ── git ──────────────────────────────────────────────────────────────
  "git-branch": {},
  "git-changes": { hideZero: FREE },
  "git-ahead-behind": { aheadGlyph: FREE, behindGlyph: FREE, glyph: FREE, hideEven: FREE },
  "git-conflicts": { glyph: FREE },
  "git-worktree": {},
  "git-origin-repo": { variant: FREE },
  "git-upstream": {},
  "git-pr": { allowNetwork: FREE, variant: FREE },
  "git-pr-review": { variant: FREE },
});

/**
 * Every option key each widget accepts (including the universal `label`
 * and the implicit `reset` axis on the token accumulators), sorted. The
 * single source of truth the validator and the coverage tests both read.
 */
export const KNOWN_OPTION_KEYS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(
    Object.entries(WIDGET_OPTIONS).map(([type, spec]) => {
      const keys = new Set<string>(["label", ...Object.keys(spec)]);
      if (RESET_WIDGETS.has(type)) keys.add("reset");
      return [type, Object.freeze([...keys].sort())];
    }),
  ),
);

function quotedList(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Validate one option key/value for `type`. Returns `null` when the pair is
 * acceptable, or a human-readable error message naming the widget and the
 * valid choices. An unknown widget type yields `null` (type validity is
 * checked separately, against the catalogue).
 */
export function validateWidgetOption(type: string, key: string, value: unknown): string | null {
  const spec = WIDGET_OPTIONS[type];
  const takesReset = RESET_WIDGETS.has(type);

  // `reset` is special: valid only on reset-bearing widgets.
  if (key === "reset") {
    if (!takesReset) {
      return `widget '${type}' does not take a 'reset' axis — run \`agentline config widget catalog\``;
    }
    return checkRule("reset", RESET_RULE, value, type);
  }

  if (UNIVERSAL_KEYS.has(key)) return null;

  // No spec for this widget → nothing to reject against (a future widget
  // the author forgot to declare; the coverage test fails on that). Accept.
  if (!spec) return null;

  const rule = spec[key];
  if (!rule) {
    const known = KNOWN_OPTION_KEYS[type] ?? [...UNIVERSAL_KEYS];
    return `unknown option '${key}' for widget '${type}' (known: ${quotedList(known)}) — run \`agentline config widget catalog\``;
  }
  return checkRule(key, rule, value, type);
}

function checkRule(key: string, rule: OptionRule, value: unknown, type: string): string | null {
  if (rule.values && (typeof value !== "string" || !rule.values.includes(value))) {
    return `invalid value ${JSON.stringify(value)} for option '${key}' on widget '${type}' (expected one of: ${quotedList(rule.values)})`;
  }
  return null;
}

/**
 * Validate a whole `options` object for `type`, returning the first failing
 * key's message or `null` when every pair is acceptable.
 */
export function validateWidgetOptions(
  type: string,
  options: Readonly<Record<string, unknown>>,
): string | null {
  for (const [key, value] of Object.entries(options)) {
    const err = validateWidgetOption(type, key, value);
    if (err) return err;
  }
  return null;
}
