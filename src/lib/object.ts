/**
 * Small structural helpers for reading untyped JSON objects (stdin
 * payloads, transcript records, host config blocks). The renderers
 * never trust input shape, so every accessor is defensive.
 */

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
