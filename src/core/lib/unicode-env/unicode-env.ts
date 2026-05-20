/**
 * Decide whether the host can render Unicode glyphs cleanly, from
 * environment hints alone (no I/O, no probing). The render hot path and
 * the editor chrome both call this so a host that can't draw Unicode
 * boxes / glyphs degrades to ASCII *identically* on both surfaces.
 *
 * Pure and synchronous — safe for the render path (§1.2 N3). Lives in
 * `src/lib/` with the other env helpers; it imports nothing.
 */

export interface UnicodeEnvOptions {
  /** Explicit override; wins over every env hint. Primarily for tests. */
  readonly unicode?: boolean;
  /** Environment to inspect; defaults to `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * `true` when Unicode glyphs are safe to emit. Defaults to `true`;
 * backs off only when `NO_UNICODE=1` / `AGENTLINE_GLYPHS=ascii` is set
 * or the locale (`LC_ALL` → `LC_CTYPE` → `LANG`) clearly isn't UTF-8.
 * An explicit `unicode` option short-circuits the heuristic.
 */
export function unicodeCapable(opts: UnicodeEnvOptions = {}): boolean {
  if (opts.unicode === true) return true;
  if (opts.unicode === false) return false;
  const env = opts.env ?? process.env;
  if (env.NO_UNICODE === "1" || env.AGENTLINE_GLYPHS === "ascii") return false;
  /*
   * Heuristic: most macOS/Linux terminals support Unicode by default;
   * only back off when LANG/LC_ALL clearly aren't UTF.
   */
  const locale = env.LC_ALL ?? env.LC_CTYPE ?? env.LANG ?? "";
  if (locale && !/utf-?8/i.test(locale)) return false;
  return true;
}
