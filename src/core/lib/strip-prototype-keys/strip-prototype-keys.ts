/**
 * Recursive strip of `__proto__` / `constructor` / `prototype` from a parsed
 * JSON tree.
 *
 * Applied at every JSON-parse boundary (config loader, env layer, theme
 * loader, fixture loader). AJV blocks unknown top-level keys, but
 * `widgets[].options` and `palette` declare `additionalProperties: true` —
 * so a `__proto__` nested under those would survive schema validation. The
 * strip is load-bearing defence in depth on top of `merge.ts`'s skip; see
 * D-010 in `docs/cookbook/10-tradeoffs-and-decisions.md`.
 */

import { isPlainObject } from "../object/object.js";

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

export function stripPrototypeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPrototypeKeys);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = stripPrototypeKeys(v);
  }
  return out;
}
