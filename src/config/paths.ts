/**
 * Resolved filesystem locations for the layered config (§4.1).
 *
 * `CLAUDE_CONFIG_DIR` and `CLAUDE_PROJECT_DIR` honour Claude Code's
 * convention so users can co-locate agentline config with the rest
 * of their Claude Code state.
 */

import { homedir } from "node:os";
import { join, isAbsolute, resolve } from "node:path";

export interface ConfigPaths {
  /** Layer-2 user config: `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`. */
  userConfig: string;
  /** Directory holding `config.json` and the copied `themes/`. */
  userDir: string;
  /** Layer-3 project config: `${CLAUDE_PROJECT_DIR:-$PWD}/.agentline.json`. */
  projectConfig: string;
}

export function resolveConfigPaths(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): ConfigPaths {
  const claudeCfg = env.CLAUDE_CONFIG_DIR;
  const baseUser = claudeCfg && claudeCfg.length > 0 ? claudeCfg : join(homedir(), ".config");
  const userDir = join(baseUser, "agentline");

  const projectBase =
    env.CLAUDE_PROJECT_DIR && env.CLAUDE_PROJECT_DIR.length > 0 ? env.CLAUDE_PROJECT_DIR : cwd;
  const projectAbs = isAbsolute(projectBase) ? projectBase : resolve(cwd, projectBase);

  return {
    userConfig: join(userDir, "config.json"),
    userDir,
    projectConfig: join(projectAbs, ".agentline.json"),
  };
}
