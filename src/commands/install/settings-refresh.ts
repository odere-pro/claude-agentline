/**
 * Propagate the configured `refreshInterval` into Claude Code's
 * `~/.claude/settings.json` `statusLine.refreshInterval`.
 *
 * agentline's own config is the source of truth; this is the one place
 * the value crosses over into Claude Code's settings. Shared by the
 * `agentline config refresh` CLI and the D09 doctor fixer (install.sh
 * has its own equivalent in the standalone path).
 *
 * Guard rails:
 *   - Only ever touches settings.json when `statusLine.command` already
 *     references agentline. A foreign / absent statusLine is left
 *     untouched and reported as `not-wired` so the caller can tell the
 *     user to run `agentline install` — we never write a partial
 *     statusLine.
 *   - `seconds >= 1` writes the field; `seconds === 0` removes it
 *     (Claude Code reverts to event-driven updates only).
 *   - Returns `unchanged` without writing when the on-disk value
 *     already matches, so `doctor --fix` stays byte-idempotent on a
 *     healthy host.
 *   - Other settings keys and `statusLine`'s position are preserved;
 *     the write is atomic (tmp + fsync + rename).
 *
 * Never imported by the render hot path (§1.2 N6).
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";

import { writeJsonIdempotent } from "../../core/lib/atomic-write.js";
import { isPlainObject } from "../../core/lib/object.js";

export type SyncRefreshResult =
  | { readonly kind: "written"; readonly path: string; readonly value: number }
  | { readonly kind: "removed"; readonly path: string }
  | { readonly kind: "unchanged"; readonly path: string }
  | { readonly kind: "not-wired"; readonly path: string };

/** `${home}/.claude/settings.json` — matches the doctor checks helper. */
export function settingsPath(home: string): string {
  return join(home, ".claude", "settings.json");
}

function statusLineRefsAgentline(sl: unknown): sl is Record<string, unknown> {
  if (!isPlainObject(sl)) return false;
  const cmd = sl["command"];
  return typeof cmd === "string" && /agentline/.test(cmd);
}

/**
 * Set / clear `statusLine.refreshInterval` in settings.json to match
 * `seconds`. See file header for the guard rails and result shape.
 */
export async function syncRefreshInterval(
  home: string,
  seconds: number,
): Promise<SyncRefreshResult> {
  const path = settingsPath(home);

  let parsed: Record<string, unknown>;
  try {
    const text = await fs.readFile(path, "utf8");
    const t: unknown = JSON.parse(text);
    if (!isPlainObject(t)) return { kind: "not-wired", path };
    parsed = t;
  } catch {
    return { kind: "not-wired", path };
  }

  const sl = parsed["statusLine"];
  if (!statusLineRefsAgentline(sl)) return { kind: "not-wired", path };

  const current = sl["refreshInterval"];

  if (seconds >= 1) {
    if (current === seconds) return { kind: "unchanged", path };
    const next = { ...parsed, statusLine: { ...sl, refreshInterval: seconds } };
    await writeJsonIdempotent(path, next, { mode: 0o600, dirMode: 0o700 });
    return { kind: "written", path, value: seconds };
  }

  // seconds === 0 → the field must be absent.
  if (current === undefined) return { kind: "unchanged", path };
  const nextSl: Record<string, unknown> = { ...sl };
  delete nextSl["refreshInterval"];
  const next = { ...parsed, statusLine: nextSl };
  await writeJsonIdempotent(path, next, { mode: 0o600, dirMode: 0o700 });
  return { kind: "removed", path };
}
