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

import { isPlainObject } from "../../../core/lib/object/object.js";

const MAX_AUTH_FILE_BYTES = 64 * 1024;

/*
 * `~/.claude.json` is the host's primary config and grows with
 * per-project history (hundreds of KB is normal). It still has to be
 * bounded so a pathological file can't pin the render path; 4 MB is
 * generous headroom over observed sizes while staying a single bounded
 * sync read.
 */
const MAX_ACCOUNT_FILE_BYTES = 4 * 1024 * 1024;

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

/**
 * Resolve Claude Code's config directory: `$CLAUDE_CONFIG_DIR` when set
 * and non-empty, otherwise `~/.claude`. The single source of truth for
 * the auth-file and plans-dir lookups (the account file is a sibling —
 * see `resolveClaudeAccountFilePath`).
 */
export function resolveClaudeConfigDir(source: AuthLookupSource): string {
  const fromEnv = source.env["CLAUDE_CONFIG_DIR"];
  return fromEnv && fromEnv.trim() !== ""
    ? fromEnv
    : path.join(source.homedir ?? os.homedir(), ".claude");
}

export function resolveAuthFilePath(source: AuthLookupSource): string {
  return path.join(resolveClaudeConfigDir(source), "auth.json");
}

export function readAuthFile(source: AuthLookupSource): AuthSnapshot | null {
  const target = resolveAuthFilePath(source);
  let raw: string;
  try {
    /*
     * Bound the read so a symlink to a huge file can't pin the render
     * path. The auth file ships as a small JSON object; 64 KB is ample.
     */
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
  if (!isPlainObject(parsed)) return null;
  return {
    ...(typeof parsed["email"] === "string" ? { email: parsed["email"] } : {}),
    ...(typeof parsed["authMethod"] === "string" ? { authMethod: parsed["authMethod"] } : {}),
    ...(typeof parsed["orgSlug"] === "string" ? { orgSlug: parsed["orgSlug"] } : {}),
  };
}

/**
 * Resolve the path to Claude Code's primary config file
 * (`.claude.json`). Unlike `auth.json` this is NOT inside the
 * `.claude` directory — it is a sibling: `${CLAUDE_CONFIG_DIR}/.claude.json`
 * when the env var is set, else `~/.claude.json`.
 */
export function resolveClaudeAccountFilePath(source: AuthLookupSource): string {
  const fromEnv = source.env["CLAUDE_CONFIG_DIR"];
  if (fromEnv && fromEnv.trim() !== "") {
    return path.join(fromEnv, ".claude.json");
  }
  return path.join(source.homedir ?? os.homedir(), ".claude.json");
}

/**
 * Identity fallback for modern host versions, which no longer ship a
 * plaintext `auth.json`. The signed-in account lives in the host's
 * primary config under `oauthAccount`. Read-only, bounded, never
 * throws — failure (missing file, oversize, malformed) yields `null`
 * so dependent widgets hide cleanly (§7.2.1). Only a handful of scalar
 * identity fields are pulled out; the rest of the (large) file is
 * ignored.
 */
export function readClaudeAccountFile(source: AuthLookupSource): AuthSnapshot | null {
  const target = resolveClaudeAccountFilePath(source);
  let raw: string;
  try {
    const stat = statSync(target);
    if (stat.size > MAX_ACCOUNT_FILE_BYTES) return null;
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
  if (!isPlainObject(parsed)) return null;
  const account = parsed["oauthAccount"];
  if (!isPlainObject(account)) return null;
  const email = account["emailAddress"];
  const orgName = account["organizationName"];
  return {
    ...(typeof email === "string" && email !== "" ? { email } : {}),
    // The presence of `oauthAccount` means the account authed via OAuth.
    ...(typeof email === "string" && email !== "" ? { authMethod: "oauth" } : {}),
    ...(typeof orgName === "string" && orgName !== "" ? { orgSlug: orgName } : {}),
  };
}
