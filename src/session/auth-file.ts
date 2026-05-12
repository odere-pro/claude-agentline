/**
 * Auth-file fallback (§7.2.1).
 *
 * When the Claude Code stdin payload omits identity fields the bin
 * reads `${CLAUDE_CONFIG_DIR:-~/.claude}/auth.json` read-only. Failure
 * renders the dependent widgets as hidden — it never throws (§7.2.1).
 *
 * The lookup is intentionally narrow: only a handful of identity
 * keys, and `readFileSync` because the resolver runs once per render
 * tick (§1.2 N3 budget) rather than per widget. No network calls
 * (§1.2 N5).
 */

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const MAX_AUTH_FILE_BYTES = 64 * 1024;

export interface AuthSnapshot {
  readonly email?: string;
  readonly authMethod?: string;
  readonly orgSlug?: string;
}

export interface AuthLookupSource {
  readonly env: NodeJS.ProcessEnv;
  /** Override for tests. Defaults to `os.homedir()`. */
  readonly homedir?: string;
}

export function resolveAuthFilePath(source: AuthLookupSource): string {
  const fromEnv = source.env["CLAUDE_CONFIG_DIR"];
  const base = fromEnv && fromEnv.trim() !== "" ? fromEnv : path.join(source.homedir ?? os.homedir(), ".claude");
  return path.join(base, "auth.json");
}

export function readAuthFile(source: AuthLookupSource): AuthSnapshot | null {
  const target = resolveAuthFilePath(source);
  let raw: string;
  try {
    // Bound the read so a symlink to a huge file can't pin the render
    // path. The auth file ships as a small JSON object; 64 KB is ample.
    const stat = statSync(target);
    if (stat.size > MAX_AUTH_FILE_BYTES) return null;
    raw = readFileSync(target, "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  return {
    ...(typeof obj["email"] === "string" ? { email: obj["email"] } : {}),
    ...(typeof obj["authMethod"] === "string" ? { authMethod: obj["authMethod"] } : {}),
    ...(typeof obj["orgSlug"] === "string" ? { orgSlug: obj["orgSlug"] } : {}),
  };
}
