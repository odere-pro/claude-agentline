/**
 * Layered config loader (§4.1).
 *
 * Order, weakest to strongest:
 *   1. Built-in defaults (`DEFAULT_CONFIG`).
 *   2. User config:   ${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json
 *   3. Project config: ${CLAUDE_PROJECT_DIR:-$PWD}/.agentline.json (if present).
 *   4. Environment vars prefixed `AGENTLINE_` (`envLayer`).
 *   5. CLI flag overrides (passed in by the caller).
 *
 * The merged tree is then validated against the JSON Schema (§4.7).
 * Missing files are silently skipped — only present files contribute.
 *
 * The render path imports this synchronously-callable wrapper so it can
 * proceed without awaiting filesystem I/O when no user config exists.
 * No network I/O ever happens here (§1.2 N5).
 */

import { promises as fs } from "node:fs";
import { DEFAULT_CONFIG } from "./defaults.js";
import { mergeAll } from "./merge.js";
import { envLayer } from "./env.js";
import { resolveConfigPaths, type ConfigPaths } from "./paths.js";
import { validateConfig } from "./validate.js";
import type { AgentlineConfig } from "./types.js";
import { resolveEnv } from "../lib/env.js";
import { isEnoent } from "../lib/fs.js";

export interface LoadedConfig {
  config: AgentlineConfig;
  paths: ConfigPaths;
  /** Layers actually consulted (omits non-existent files). */
  sources: {
    user: boolean;
    project: boolean;
  };
}

export interface LoadOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  /** Final-layer overrides (typically from `--key=value` flags). */
  flagOverrides?: Record<string, unknown>;
  /** Skip validation — for tests only. */
  skipValidation?: boolean;
}

export async function loadConfig(options: LoadOptions = {}): Promise<LoadedConfig> {
  const env = resolveEnv(options);
  const cwd = options.cwd ?? process.cwd();
  const paths = resolveConfigPaths(env, cwd);

  const userOverride = await readJsonIfExists(paths.userConfig);
  const rawProjectOverride = await readJsonIfExists(paths.projectConfig);
  const projectOverride = stripUntrustedProjectWidgets(rawProjectOverride, env);
  const envOverride = envLayer(env);
  const flagOverride = options.flagOverrides ?? {};

  const merged = mergeAll<AgentlineConfig>(
    structuredClone(DEFAULT_CONFIG),
    userOverride,
    projectOverride,
    envOverride,
    flagOverride,
  );

  if (!options.skipValidation) validateConfig(merged);

  return {
    config: merged,
    paths,
    sources: {
      user: userOverride !== undefined,
      project: projectOverride !== undefined,
    },
  };
}

// Project-layer config (`.agentline.json` in the cwd) is loaded automatically
// when the user runs Claude Code in that directory. Allowing a project file
// to declare a `command` widget would mean cloning a hostile repo and
// running Claude Code with a statusline refresh = arbitrary code execution.
// Strip `command` widgets unless the user explicitly opts in via
// `AGENTLINE_TRUST_PROJECT_COMMAND_WIDGETS=1`. Other widget types remain
// untouched so the project layer keeps its day-to-day usefulness.
function stripUntrustedProjectWidgets(
  override: unknown,
  env: NodeJS.ProcessEnv,
): unknown {
  if (env["AGENTLINE_TRUST_PROJECT_COMMAND_WIDGETS"] === "1") return override;
  if (!override || typeof override !== "object" || Array.isArray(override)) return override;
  const obj = override as Record<string, unknown>;
  const lines = obj["lines"];
  if (!Array.isArray(lines)) return override;
  let stripped = false;
  const nextLines = lines.map((line) => {
    if (!line || typeof line !== "object" || Array.isArray(line)) return line;
    const widgets = (line as Record<string, unknown>)["widgets"];
    if (!Array.isArray(widgets)) return line;
    const filtered = widgets.filter((w) => {
      const isCommand =
        w !== null &&
        typeof w === "object" &&
        !Array.isArray(w) &&
        (w as Record<string, unknown>)["type"] === "command";
      if (isCommand) stripped = true;
      return !isCommand;
    });
    if (filtered.length === widgets.length) return line;
    return { ...(line as Record<string, unknown>), widgets: filtered };
  });
  if (!stripped) return override;
  if (process.stderr.isTTY) {
    process.stderr.write(
      "agentline: dropped `command` widget(s) from project config (untrusted source). " +
        "Set AGENTLINE_TRUST_PROJECT_COMMAND_WIDGETS=1 to allow.\n",
    );
  }
  return { ...obj, lines: nextLines };
}

async function readJsonIfExists(path: string): Promise<unknown> {
  try {
    const text = await fs.readFile(path, "utf8");
    return JSON.parse(text);
  } catch (err) {
    if (isEnoent(err)) return undefined;
    if (err instanceof SyntaxError) {
      throw new Error(`agentline: ${path}: invalid JSON — ${err.message}`);
    }
    throw err;
  }
}
