/**
 * Small structural helpers for reading untyped JSON objects (stdin
 * payloads, transcript records, host config blocks). The renderers
 * never trust input shape, so every accessor is defensive.
 */

/**
 * Narrows `unknown` to a string-keyed record when `v` is a plain object —
 * one whose prototype is `Object.prototype` or `null`. Rejects arrays,
 * `null`, primitives, and exotic objects (Map, Set, class instances).
 *
 * Use as the gate before treating a `JSON.parse` result as a property bag.
 */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Returns `obj[key]` when it is a non-empty string. Any other shape —
 * undefined obj, missing key, non-string, empty string — yields `undefined`.
 */
export function pickString(
  obj: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!obj) return undefined;
  const v = obj[key];
  return typeof v === "string" && v !== "" ? v : undefined;
}

/**
 * Returns the elements of `obj[key]` that are non-empty strings, or
 * `undefined` when the field is missing, not an array, or has no
 * usable entries.
 */
export function pickStringArray(
  obj: Record<string, unknown> | undefined,
  key: string,
): string[] | undefined {
  if (!obj) return undefined;
  const v = obj[key];
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const entry of v) {
    if (typeof entry === "string" && entry !== "") out.push(entry);
  }
  return out.length ? out : undefined;
}

/**
 * Returns `obj[key]` narrowed to one of `allowed`, or `undefined` when
 * the field is absent, non-string, or outside the allowed set.
 *
 * Use when a caller wants exhaustive handling of a known-enum field: a
 * future contract revision that adds an unknown value will surface as
 * `undefined` rather than as an arbitrary string the consumer can't
 * exhaustively switch on. Pair with `pickString` when forward-compat
 * with unknown values matters more than exhaustiveness (the
 * `thinking-effort` widget, for example, passes unknown levels through
 * uncoloured rather than hiding them).
 */
export function pickEnum<T extends string>(
  obj: Record<string, unknown> | undefined,
  key: string,
  allowed: ReadonlySet<T>,
): T | undefined {
  if (!obj) return undefined;
  const v = obj[key];
  if (typeof v !== "string") return undefined;
  return allowed.has(v as T) ? (v as T) : undefined;
}
