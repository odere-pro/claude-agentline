/**
 * Plain-data deep merge for layered config (§4.1).
 *
 * Rules:
 *   - Plain objects merge key-wise; right wins on scalar conflict.
 *   - Arrays REPLACE wholesale — a user-supplied `lines` overrides the default
 *     line entirely; partial line edits go through the TUI editor (§5.5),
 *     not the merge layer.
 *   - `null` is a real value (e.g. `theme: null` clears an inherited theme).
 *   - `undefined` is a no-op (the layer didn't speak to the key).
 *   - `__proto__`, `constructor`, and `prototype` keys are dropped before
 *     the recursive copy so an external JSON layer cannot pollute
 *     `Object.prototype`. AJV validation runs after merge, but defending
 *     here keeps the merge function safe in isolation.
 */

import { isPlainObject } from "../../../core/lib/object/object.js";

type Plain = Record<string, unknown>;

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function deepMerge<T>(base: T, override: unknown): T {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override as T;
  }
  const out: Plain = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined) continue;
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = deepMerge(out[k], v);
  }
  return out as T;
}

export function mergeAll<T>(base: T, ...overrides: unknown[]): T {
  return overrides.reduce<T>((acc, layer) => deepMerge(acc, layer), base);
}
