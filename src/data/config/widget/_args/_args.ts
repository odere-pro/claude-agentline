/**
 * Shared CLI flag parsers for the `agentline config widget <sub>` subcommands.
 *
 * Each helper takes a `prefix` (e.g. `"agentline config widget add"`) that is
 * prepended verbatim to every error message, so callers preserve their
 * subcommand identity in stderr without duplicating the parser body.
 *
 * The parsers accept both whitespace-separated (`--line 3`) and equals-style
 * (`--line=3`) flag forms. Callers advance `i` by one extra step for the
 * whitespace form; the helpers themselves do not mutate `i`.
 */

const FORBIDDEN_OPTION_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/**
 * Read an integer-valued flag.
 *
 * Error modes (prefix prepended):
 *   - `${name} requires an integer` — the value slot is empty or looks like
 *     another flag (starts with `-`).
 *   - `${name} must be an integer, got '<raw>'` — a value is present but it
 *     does not parse as an integer.
 */
export function readIntFlag(
  arg: string,
  rest: readonly string[],
  i: number,
  name: string,
  prefix: string,
): number {
  const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : rest[i + 1];
  if (raw === undefined || raw.startsWith("-")) {
    throw new Error(`${prefix}: ${name} requires an integer`);
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new Error(`${prefix}: ${name} must be an integer, got '${raw}'`);
  }
  return n;
}

/**
 * Read a `--options JSON` flag whose value must be a JSON object literal.
 * Rejects keys that would pollute `Object.prototype`.
 */
export function readOptionsFlag(
  arg: string,
  rest: readonly string[],
  i: number,
  prefix: string,
): Record<string, unknown> {
  const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : rest[i + 1];
  if (raw === undefined) {
    throw new Error(`${prefix}: --options requires a JSON object`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${prefix}: --options is not valid JSON (${(err as Error).message})`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${prefix}: --options must be a JSON object`);
  }
  for (const key of Object.keys(parsed as object)) {
    if (FORBIDDEN_OPTION_KEYS.has(key)) {
      throw new Error(`${prefix}: option key '${key}' is not allowed`);
    }
  }
  return parsed as Record<string, unknown>;
}
