/**
 * Resolved filesystem locations for the global agentline config (§4.1).
 *
 * `CLAUDE_CONFIG_DIR` honours Claude Code's convention so users can
 * co-locate agentline config with the rest of their Claude Code state.
 *
 * agentline is configured globally only — there is no per-project
 * config. Both the editor and any programmatic mutator write to
 * `userConfig`.
 */

import { homedir } from "node:os";
import { join } from "node:path";

export interface ConfigPaths {
  /** `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`. */
  userConfig: string;
  /** Directory holding `config.json` and the copied `themes/`. */
  userDir: string;
}

export function resolveConfigPaths(env: NodeJS.ProcessEnv = process.env): ConfigPaths {
  const claudeCfg = env.CLAUDE_CONFIG_DIR;
  const baseUser = claudeCfg && claudeCfg.length > 0 ? claudeCfg : join(homedir(), ".config");
  const userDir = join(baseUser, "agentline");

  return {
    userConfig: join(userDir, "config.json"),
    userDir,
  };
}
