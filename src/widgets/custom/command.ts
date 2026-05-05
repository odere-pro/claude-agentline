/**
 * `command` widget (§7.8.3, §1.4 O2).
 *
 * Runs `cmd` in a sandboxed subprocess synchronously and renders the
 * trimmed stdout. Per spec:
 *
 *   - timeout default 250 ms, max 2 000 ms (clamped)
 *   - cache TTL configurable; 0 disables caching
 *   - stdout truncated at `byteLimit`
 *   - non-zero exit / timeout / spawn failure renders `onError`
 *   - stderr is discarded
 *   - environment is `agentline`'s env plus any `CLAUDE_*` vars
 *
 * Cache keys include cmd + shell + cwd so the same `cmd` string in
 * two different repos doesn't collide. Cache is a module-level Map;
 * a `clearCommandCache()` helper exists for tests.
 */

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";

import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";

// Allowlist of shells the command widget will spawn. Any other value in
// `options.shell` falls back to DEFAULT_SHELL. Prevents project-config
// or env-layer overrides from substituting a controlled binary.
const SHELL_ALLOWLIST: ReadonlySet<string> = new Set([
  "/bin/sh",
  "/bin/bash",
  "/usr/bin/sh",
  "/usr/bin/bash",
  "/usr/local/bin/bash",
  "cmd.exe",
  "powershell.exe",
  "pwsh.exe",
]);

// Env-var keys that look credential-bearing — never forwarded to a
// command-widget subprocess even when the prefix matches CLAUDE_*.
const CREDENTIAL_KEY_RE = /(_TOKEN|_KEY|_SECRET|_PASSWORD|_PASS|_AUTH)$/i;

export interface CommandOptions {
  readonly cmd?: string;
  readonly timeoutMs?: number;
  readonly cacheTtlMs?: number;
  readonly byteLimit?: number;
  readonly trim?: boolean;
  readonly onError?: string;
  readonly shell?: string;
  readonly cwd?: string;
}

const DEFAULT_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 2_000;
const DEFAULT_CACHE_TTL_MS = 1_000;
const DEFAULT_BYTE_LIMIT = 1_024;
const DEFAULT_ON_ERROR = "✗";
const DEFAULT_SHELL = process.platform === "win32" ? "cmd.exe" : "/bin/sh";

interface CacheEntry {
  readonly value: string | null;
  readonly expiresAt: number;
}

const cache: Map<string, CacheEntry> = new Map();

export function clearCommandCache(): void {
  cache.clear();
}

function clampPositive(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return Math.min(Math.floor(value), max);
}

// Keys always forwarded to the subprocess (§7.8.3 sandbox contract).
const ENV_PASSTHROUGH = new Set([
  "PATH", "HOME", "USER", "USERNAME", "LOGNAME",
  "LANG", "TERM", "TMPDIR", "TMP", "TEMP", "SHELL",
  "USERPROFILE", "SYSTEMROOT", "WINDIR", "COMSPEC",
]);

function pickEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(env)) {
    const allowed =
      ENV_PASSTHROUGH.has(k) || k.startsWith("LC_") || k.startsWith("CLAUDE_");
    if (!allowed) continue;
    // Drop credential-shaped keys even when the family prefix matches.
    // CLAUDE_API_KEY, CLAUDE_ANTHROPIC_TOKEN, etc. should never reach a
    // user-supplied shell command.
    if (CREDENTIAL_KEY_RE.test(k)) continue;
    next[k] = v;
  }
  return next;
}

function shellArgs(shell: string, cmd: string): readonly string[] {
  if (/cmd\.exe$/i.test(shell) || /powershell\.exe$/i.test(shell)) {
    return ["/c", cmd];
  }
  return ["-c", cmd];
}

function truncate(buf: Buffer, limit: number): Buffer {
  return buf.byteLength > limit ? buf.subarray(0, limit) : buf;
}

interface RunInput {
  readonly cmd: string;
  readonly shell: string;
  readonly timeoutMs: number;
  readonly byteLimit: number;
  readonly cwd: string | undefined;
  readonly env: NodeJS.ProcessEnv;
  readonly trim: boolean;
}

function runCommand(input: RunInput): string | null {
  try {
    // `maxBuffer` is set well above `byteLimit` so spawn doesn't
    // throw on extra output; we always truncate to `byteLimit` after.
    const out = execFileSync(input.shell, shellArgs(input.shell, input.cmd), {
      encoding: "buffer",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: input.timeoutMs,
      maxBuffer: 1024 * 1024,
      env: pickEnv(input.env),
      ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
      windowsHide: true,
    });
    const truncated = truncate(out, input.byteLimit);
    let text = truncated.toString("utf8");
    if (input.trim) text = text.replace(/[\r\n\s]+$/u, "");
    return text;
  } catch {
    return null;
  }
}

// INTENTIONAL EXCEPTION: this render function performs synchronous I/O via execFileSync.
// SPEC §7.8.3 explicitly requires subprocess execution for the `command` widget type —
// it is the widget's sole purpose. The widget contract (no I/O in render) is suspended
// here by spec design; all other widgets remain pure.
export const commandWidget = defineWidget<CommandOptions>("command", (ctx, settings): Cell => {
  const cmd = typeof settings.options.cmd === "string" ? settings.options.cmd : "";
  if (!cmd) return { text: "", hidden: true };

  const onError = typeof settings.options.onError === "string"
    ? settings.options.onError
    : DEFAULT_ON_ERROR;
  const timeoutMs = clampPositive(settings.options.timeoutMs, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const cacheTtlMs = clampPositive(settings.options.cacheTtlMs, DEFAULT_CACHE_TTL_MS, 60 * 60 * 1000);
  const byteLimit = clampPositive(settings.options.byteLimit, DEFAULT_BYTE_LIMIT, 64 * 1024);
  const trim = settings.options.trim !== false;
  const requestedShell = typeof settings.options.shell === "string" ? settings.options.shell : "";
  const shell = SHELL_ALLOWLIST.has(requestedShell) ? requestedShell : DEFAULT_SHELL;
  const cwd = resolveCwd(settings.options.cwd, ctx.stdin.cwd);

  const cacheKey = `${shell}:${cwd ?? ""}:${cmd}`;
  const now = ctx.clock.now().getTime();

  if (cacheTtlMs > 0) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now) {
      return cellOf(hit.value, onError);
    }
  }

  const value = runCommand({
    cmd,
    shell,
    timeoutMs,
    byteLimit,
    cwd,
    env: ctx.env,
    trim,
  });

  if (cacheTtlMs > 0) {
    cache.set(cacheKey, { value, expiresAt: now + cacheTtlMs });
  }

  return cellOf(value, onError);
});

// Validate a candidate cwd: must be a string, absolute, exist, and be a
// directory. Falls back to undefined (subprocess inherits agentline's cwd)
// when validation fails — better to spawn in a known directory than to
// follow a potentially attacker-controlled path from stdin.
function resolveCwd(opt: unknown, stdinCwd: string | undefined): string | undefined {
  const candidate = typeof opt === "string" && opt ? opt : stdinCwd;
  if (!candidate || !isAbsolute(candidate)) return undefined;
  try {
    if (!existsSync(candidate)) return undefined;
    if (!statSync(candidate).isDirectory()) return undefined;
  } catch {
    return undefined;
  }
  return candidate;
}

function cellOf(value: string | null, onError: string): Cell {
  if (value === null) return { text: onError };
  if (value === "") return { text: "", hidden: true };
  return { text: value };
}
