/**
 * Spawn the host `claude` CLI to probe its health. **Off the render path
 * only** — this module is imported by the claude-health refresher
 * (`__refresh-claude-health` verb + doctor D10), never by a render-reachable
 * module (gate 13 / gate 14).
 *
 * Both runners return trimmed stdout or `null` on any failure (binary
 * missing, non-zero exit, timeout). We capture stdout; `claude doctor`'s
 * stderr is captured too since some diagnostics surface there.
 */

import { execFileSync } from "node:child_process";

const VERSION_TIMEOUT_MS = 2000;
const DOCTOR_TIMEOUT_MS = 5000;
const MAX_BUFFER = 1024 * 1024;

export interface ClaudeInvokeOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
}

function run(args: readonly string[], timeoutMs: number, env?: NodeJS.ProcessEnv): string | null {
  try {
    const out = execFileSync("claude", args, {
      encoding: "utf8",
      maxBuffer: MAX_BUFFER,
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "pipe"],
      env,
      windowsHide: true,
    });
    return out.trim();
  } catch (err) {
    /*
     * A non-zero exit still carries useful stdout for `claude doctor`
     * (it exits non-zero when it finds problems). Salvage it when present.
     */
    const stdout = (err as { stdout?: Buffer | string } | undefined)?.stdout;
    if (stdout) {
      const text = (Buffer.isBuffer(stdout) ? stdout.toString("utf8") : stdout).trim();
      if (text.length > 0) return text;
    }
    return null;
  }
}

/** `claude --version` → raw stdout, or `null` when the binary is absent. */
export function runClaudeVersion(options: ClaudeInvokeOptions = {}): string | null {
  return run(["--version"], options.timeoutMs ?? VERSION_TIMEOUT_MS, options.env);
}

/**
 * `claude doctor` run non-interactively → raw stdout, or `null` on failure.
 * The output is heuristic and may be a TUI dump; `parseClaudeDoctor` does the
 * best-effort interpretation.
 */
export function runClaudeDoctor(options: ClaudeInvokeOptions = {}): string | null {
  return run(["doctor"], options.timeoutMs ?? DOCTOR_TIMEOUT_MS, options.env);
}
