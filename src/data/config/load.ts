/**
 * Layered config loader (§4.1).
 *
 * Order, weakest to strongest:
 *   1. Built-in defaults (`DEFAULT_CONFIG`).
 *   2. User config: `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`.
 *   3. Environment vars prefixed `AGENTLINE_` (`envLayer`).
 *   4. CLI flag overrides (passed in by the caller).
 *
 * The merged tree is then validated against the JSON Schema (§4.7).
 * Missing files are silently skipped — only present files contribute.
 *
 * agentline is configured globally only — there is no per-project
 * config. A `.agentline.json` in the cwd is silently ignored.
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
import { resolveEnv } from "../../core/lib/env.js";
import { isEnoent } from "../../core/lib/fs.js";

export interface LoadedConfig {
  config: AgentlineConfig;
  paths: ConfigPaths;
  /** Layers actually consulted (omits non-existent files). */
  sources: {
    user: boolean;
  };
}

export interface LoadOptions {
  env?: NodeJS.ProcessEnv;
  /** Final-layer overrides (typically from `--key=value` flags). */
  flagOverrides?: Record<string, unknown>;
  /** Skip validation — for tests only. */
  skipValidation?: boolean;
}

export async function loadConfig(options: LoadOptions = {}): Promise<LoadedConfig> {
  const env = resolveEnv(options);
  const paths = resolveConfigPaths(env);

  const userOverride = await readJsonIfExists(paths.userConfig);
  const envOverride = envLayer(env);
  const flagOverride = options.flagOverrides ?? {};

  const merged = dropRetiredKeys(
    mergeAll<AgentlineConfig>(
      structuredClone(DEFAULT_CONFIG),
      userOverride,
      envOverride,
      flagOverride,
    ),
  );

  if (!options.skipValidation) validateConfig(merged);

  return {
    config: merged,
    paths,
    sources: {
      user: userOverride !== undefined,
    },
  };
}

/**
 * Top-level keys that were valid in an earlier release but have since
 * been removed. Strict validation (`additionalProperties: false`) would
 * otherwise hard-fail a config written by a prior install — bricking the
 * statusline on upgrade — so we silently drop these before validating.
 * Keys that were *never* valid still fail; this only forgives the ones
 * we deliberately retired.
 *
 *   - `glyphs` — the top-level Nerd Font glyph mode, removed in the
 *     glyphs teardown (it never worked reliably across terminals).
 */
const RETIRED_TOP_LEVEL_KEYS = ["glyphs"] as const;

function dropRetiredKeys(config: AgentlineConfig): AgentlineConfig {
  const record = config as unknown as Record<string, unknown>;
  if (!RETIRED_TOP_LEVEL_KEYS.some((key) => key in record)) return config;
  const next: Record<string, unknown> = { ...record };
  for (const key of RETIRED_TOP_LEVEL_KEYS) delete next[key];
  return next as unknown as AgentlineConfig;
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
