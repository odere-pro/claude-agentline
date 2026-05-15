/**
 * Nerd Font availability — best-effort detection plus a persisted sentinel
 * so consumers can read the last detection result synchronously.
 *
 * `install` runs detection once and writes `nerd-font.json` into the
 * config state dir; the TUI editor reads that sentinel on startup so the
 * `g` (toggle-glyphs) keybinding can refuse to enable glyphs on a host
 * where they would only render as tofu boxes. Detection itself shells
 * out to platform-specific tooling (`fc-list`, `system_profiler`) and
 * can take seconds — we never run it on the render hot path.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { writeJsonIdempotent } from "./atomic-write.js";
import { isPlainObject } from "./object.js";

const EXEC_TIMEOUTS = {
  fcList: 2500,
  systemProfiler: 5000,
} as const;

/** Filename under the state dir holding the last detection result. */
export const NERD_FONT_SENTINEL = "nerd-font.json";

export interface NerdFontStatus {
  /** `true` when detection found a Nerd Font installed for the user. */
  readonly available: boolean;
  /** ISO timestamp of the detection run. */
  readonly checkedAt: string;
}

/**
 * Synchronous best-effort Nerd Font detection. Returns `true` when the
 * platform's font listing contains a family whose name matches
 * /nerd font/i. Falls through to `false` on any error so consumers can
 * treat "unknown" as "not present" (the safer default).
 */
export function detectNerdFontSync(): boolean {
  try {
    if (process.platform === "linux") {
      const out = execFileSync("fc-list", [], {
        timeout: EXEC_TIMEOUTS.fcList,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return /nerd font/i.test(out);
    }
    if (process.platform === "darwin") {
      const out = execFileSync("system_profiler", ["SPFontsDataType"], {
        timeout: EXEC_TIMEOUTS.systemProfiler,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return /nerd font/i.test(out);
    }
  } catch {
    /* fall through */
  }
  return false;
}

/** Write the sentinel file via the shared tmp + fsync + rename helper. */
export async function writeNerdFontStatus(
  stateDir: string,
  available: boolean,
): Promise<NerdFontStatus> {
  const status: NerdFontStatus = {
    available,
    checkedAt: new Date().toISOString(),
  };
  await writeJsonIdempotent(join(stateDir, NERD_FONT_SENTINEL), status, {
    mode: 0o600,
    dirMode: 0o700,
  });
  return status;
}

/**
 * Read the sentinel. Returns `null` when the file is missing or unreadable
 * — callers treat that as "never detected", which the editor surfaces as
 * "Nerd Font assumed present" so a user who skipped install isn't punished.
 */
export function readNerdFontStatus(stateDir: string): NerdFontStatus | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(stateDir, NERD_FONT_SENTINEL), "utf8"));
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) return null;
  if (typeof parsed.available !== "boolean") return null;
  return {
    available: parsed.available,
    checkedAt: typeof parsed.checkedAt === "string" ? parsed.checkedAt : "",
  };
}

/**
 * Resolve the state directory the install script + doctor use. Mirrors
 * `scripts/lib/common.sh`: `${CLAUDE_CONFIG_DIR:-~/.config/agentline}/state`.
 */
export function stateDir(env: NodeJS.ProcessEnv, home: string): string {
  const configDir = env.CLAUDE_CONFIG_DIR ?? join(home, ".config", "agentline");
  return join(configDir, "state");
}
