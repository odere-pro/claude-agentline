/**
 * Body for `agentline init` (§9.1, §10).
 *
 * Scaffolds a config file from a shipped preset. Idempotent: refuses
 * to overwrite an existing target unless `--force` is passed. Atomic
 * write via the existing helper.
 *
 * Flag surface:
 *   --preset <name>   one of `minimal | default | focus | power`
 *   --minimal         deprecated alias for `--preset minimal`
 *   --scope <where>   `user` (~/.config/agentline/config.json) or
 *                     `project` (default — `.agentline.json` in cwd)
 *   --target <path>   explicit override; takes precedence over --scope
 *   --force           overwrite an existing target
 *
 * After a successful write the command prints two next-step hints
 * (preview + doctor wiring) so the user does not have to read docs
 * to know what to do next.
 */

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { atomicWrite } from "../config/atomic.js";
import { resolveConfigPaths } from "../config/paths.js";
import { resolveEnv } from "../lib/env.js";
import { pathExists } from "../lib/fs.js";

const HELP = `agentline init — scaffold a config file from a shipped preset

Usage:
  agentline init [--preset <name>] [--scope <where>] [--target <path>] [--force]

Presets:
  minimal   model + git-branch + clock
  default   full bar (model + git + tokens + cost + session-usage + clock)
  focus     model + git + context-percentage + clock
  power     full default + thinking-effort, weekly-usage, block-timer

Options:
  --preset <name>     one of minimal | default | focus | power (default: default)
  --minimal           deprecated alias for --preset minimal
  --scope <where>     user (~/.config/agentline/config.json) or
                      project (.agentline.json — default)
  --target <path>     explicit override; takes precedence over --scope
  --force             overwrite an existing target
  -h, --help          show this message

After writing, the command prints next-step hints for preview + doctor.
`;

export type InitPreset = "minimal" | "default" | "focus" | "power";
export type InitScope = "user" | "project";

const PRESETS: ReadonlySet<InitPreset> = new Set(["minimal", "default", "focus", "power"]);
const SCOPES: ReadonlySet<InitScope> = new Set(["user", "project"]);

export interface InitCommandArgs {
  readonly preset: InitPreset;
  readonly scope: InitScope;
  readonly force: boolean;
  readonly target?: string;
}

export interface InitInput {
  readonly args: InitCommandArgs;
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
  /** Override template directory; primarily used by tests. */
  readonly templateDir?: string;
}

export async function runInitCommand(input: InitInput): Promise<number> {
  const env = resolveEnv(input);
  const cwd = input.cwd ?? process.cwd();
  const target = input.args.target ?? resolveTargetForScope(input.args.scope, env, cwd);
  const templateDir = input.templateDir ?? defaultTemplateDir();
  const templateFile = templateFileFor(input.args.preset);
  const templatePath = join(templateDir, templateFile);

  const exists = await pathExists(target);
  if (exists && !input.args.force) {
    process.stderr.write(
      `agentline init: ${target} already exists; pass --force to overwrite\n`,
    );
    return 1;
  }

  let body: string;
  try {
    body = await fs.readFile(templatePath, "utf8");
  } catch (err) {
    process.stderr.write(
      `agentline init: unable to read template ${basename(templatePath)}: ${(err as Error).message}\n`,
    );
    return 1;
  }
  await atomicWrite(target, body, { mode: 0o644 });
  process.stdout.write(
    [
      `agentline: wrote ${target} (preset: ${input.args.preset})`,
      `  preview: agentline preview --config ${target}`,
      `  wire it up: agentline doctor --fix`,
      "",
    ].join("\n"),
  );
  return 0;
}

function resolveTargetForScope(
  scope: InitScope,
  env: NodeJS.ProcessEnv,
  cwd: string,
): string {
  const paths = resolveConfigPaths(env, cwd);
  return scope === "user" ? paths.userConfig : paths.projectConfig;
}

function templateFileFor(preset: InitPreset): string {
  switch (preset) {
    case "minimal":
      return "minimal.config.json";
    case "default":
      return "default.config.json";
    case "focus":
      return "presets/focus.config.json";
    case "power":
      return "presets/power.config.json";
  }
}

export function parseInitArgs(rest: readonly string[]): InitCommandArgs {
  let preset: InitPreset | undefined;
  let scope: InitScope = "project";
  let force = false;
  let target: string | undefined;
  let minimalAliasUsed = false;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (isHelpFlag(arg)) {
      requestHelp(HELP);
    } else if (arg === "--preset") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline init: --preset requires one of minimal|default|focus|power");
      }
      assertPreset(next);
      preset = next;
      i += 1;
    } else if (arg && arg.startsWith("--preset=")) {
      const value = arg.slice("--preset=".length);
      assertPreset(value);
      preset = value;
    } else if (arg === "--minimal") {
      minimalAliasUsed = true;
    } else if (arg === "--scope") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline init: --scope requires one of user|project");
      }
      assertScope(next);
      scope = next;
      i += 1;
    } else if (arg && arg.startsWith("--scope=")) {
      const value = arg.slice("--scope=".length);
      assertScope(value);
      scope = value;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--target") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline init: --target requires a path");
      }
      target = next;
      i += 1;
    } else if (arg && arg.startsWith("--target=")) {
      target = arg.slice("--target=".length);
    } else if (arg) {
      throw new Error(`agentline init: unknown argument '${arg}'`);
    }
  }
  if (preset !== undefined && minimalAliasUsed) {
    throw new Error("agentline init: --minimal and --preset are mutually exclusive");
  }
  const resolvedPreset: InitPreset = preset ?? (minimalAliasUsed ? "minimal" : "default");
  const out: InitCommandArgs = { preset: resolvedPreset, scope, force };
  if (target !== undefined) (out as { target: string }).target = target;
  return out;
}

function assertPreset(value: string): asserts value is InitPreset {
  if (!PRESETS.has(value as InitPreset)) {
    throw new Error(
      `agentline init: unknown preset '${value}' (expected minimal|default|focus|power)`,
    );
  }
}

function assertScope(value: string): asserts value is InitScope {
  if (!SCOPES.has(value as InitScope)) {
    throw new Error(`agentline init: unknown scope '${value}' (expected user|project)`);
  }
}

function defaultTemplateDir(): string {
  // Templates ship under `templates/` at the package root; cli.mjs
  // lives at `dist/cli.mjs`, so the path is `../templates/`.
  const cliDir = dirname(fileURLToPath(import.meta.url));
  return join(cliDir, "..", "templates");
}

