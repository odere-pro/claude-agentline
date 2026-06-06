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
 * Scope: this declares the keys/values the project knows how to validate.
 * `label` is universal (every widget reads `settings.options.label`). A
 * widget with no entry here accepts any non-reserved key — there is no
 * source of truth to reject against, and the reserved-prototype keys are
 * already blocked upstream in `setWidgetOption`.
 */

import { RESET_AXES, type ResetAxis } from "../../../data/tokens/index.js";

/** A single option's contract: allowed value set, or free (any value). */
interface OptionRule {
  /** Allowed string values; omit for a free-form value (e.g. a label). */
  readonly values?: readonly string[];
}

/** Per-widget known option keys. `label` is added universally at lookup. */
interface WidgetOptionSpec {
  readonly [key: string]: OptionRule;
}

const RESET_RULE: OptionRule = { values: RESET_AXES as readonly ResetAxis[] };

/**
 * Widgets that take a `reset` axis (the token accumulators). Kept here as
 * the authoring-time mirror of `resolveResetAxis`'s accepted set.
 */
const RESET_WIDGETS: ReadonlySet<string> = new Set(["tokens", "tokens-cached"]);

/**
 * Known option keys/values per widget type. Only widgets with validatable
 * options need an entry; everything else falls through to "accept any
 * non-reserved key". `label` is implicit and added at lookup time.
 */
const WIDGET_OPTIONS: Readonly<Record<string, WidgetOptionSpec>> = Object.freeze({
  clock: { format: { values: ["24h", "12h"] }, seconds: {} },
  "account-email": { mask: { values: ["none", "domain", "localpart"] } },
  "output-style": { showDefault: {} },
  "cwd-path": { maxLength: {} },
  "token-speed": { windowSec: {}, inputGlyph: {}, outputGlyph: {} },
  tokens: { inputGlyph: {}, outputGlyph: {} },
});

/** The universal option every widget accepts. */
const UNIVERSAL_KEYS: ReadonlySet<string> = new Set(["label"]);

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

  // No spec for this widget → nothing to reject against (besides reserved
  // keys, blocked upstream). Accept.
  if (!spec) return null;

  const rule = spec[key];
  if (!rule) {
    const known = [...UNIVERSAL_KEYS, ...Object.keys(spec), ...(takesReset ? ["reset"] : [])].sort();
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
