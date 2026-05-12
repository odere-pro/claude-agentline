/**
 * Body for `agentline config init` (§9.1, §10).
 *
 * Scaffolds the user config file from a shipped preset. Idempotent:
 * refuses to overwrite an existing target unless `--force` is passed.
 * Atomic write via the existing helper.
 *
 * agentline is configured globally only — there is no per-project
 * config. The default target is `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`;
 * `--target <path>` overrides for tests or unusual setups.
 *
 * Flag surface:
 *   --preset <name>   one of `minimal | default | maximal`
 *   --target <path>   explicit override of the default user-config path
 *   --force           overwrite an existing target
 *
 * After a successful write the command prints next-step hints
 * (verify + doctor wiring) so the user does not have to read docs
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

const HELP = `agentline config init — scaffold the user config file from a shipped preset

Usage:
  agentline config init [--preset <name>] [--target <path>] [--force]

Presets:
  minimal   essentials only — model + context-length + block-reset-timer (5h)
  default   balanced bar — model, git, context, tokens, cost, session usage, clock
  maximal   curated everything — adds thinking-effort, weekly usage, weekly + 5h timers

Options:
  --preset <name>     one of minimal | default | maximal (default: default)
  --target <path>     write to this path instead of the default user-config
                      location (\`\${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json\`)
  --force             overwrite an existing target
  -h, --help          show this message

After writing, the command prints next-step hints for verify + doctor.
`;

export type InitPreset = "minimal" | "default" | "maximal";

const PRESETS: ReadonlySet<InitPreset> = new Set(["minimal", "default", "maximal"]);

export interface InitCommandArgs {
  readonly preset: InitPreset;
  readonly force: boolean;
  readonly target?: string;
}

export interface InitInput {
  readonly args: InitCommandArgs;
  readonly env?: NodeJS.ProcessEnv;
  /** Override template directory; primarily used by tests. */
  readonly templateDir?: string;
}

export async function runInitCommand(input: InitInput): Promise<number> {
  const env = resolveEnv(input);
  const target = input.args.target ?? resolveConfigPaths(env).userConfig;
  const templateDir = input.templateDir ?? defaultTemplateDir();
  const templateFile = templateFileFor(input.args.preset);
  const templatePath = join(templateDir, templateFile);

  const exists = await pathExists(target);
  if (exists && !input.args.force) {
    process.stderr.write(
      `agentline config init: ${target} already exists; pass --force to overwrite\n`,
    );
    return 1;
  }

  let body: string;
  try {
    body = await fs.readFile(templatePath, "utf8");
  } catch (err) {
    process.stderr.write(
      `agentline config init: unable to read template ${basename(templatePath)}: ${(err as Error).message}\n`,
    );
    return 1;
  }
  await atomicWrite(target, body, { mode: 0o644 });
  process.stdout.write(
    [
      `agentline: wrote ${target} (preset: ${input.args.preset})`,
      `  verify: agentline doctor`,
      `  wire it up: agentline doctor --fix`,
      "",
    ].join("\n"),
  );
  return 0;
}

function templateFileFor(preset: InitPreset): string {
  switch (preset) {
    case "minimal":
      return "minimal.config.json";
    case "default":
      return "default.config.json";
    case "maximal":
      return "presets/maximal.config.json";
  }
}

export function parseInitArgs(rest: readonly string[]): InitCommandArgs {
  let preset: InitPreset | undefined;
  let force = false;
  let target: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (isHelpFlag(arg)) {
      requestHelp(HELP);
    } else if (arg === "--preset") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error(
          "agentline config init: --preset requires one of minimal|default|maximal",
        );
      }
      assertPreset(next);
      preset = next;
      i += 1;
    } else if (arg && arg.startsWith("--preset=")) {
      const value = arg.slice("--preset=".length);
      assertPreset(value);
      preset = value;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--target") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline config init: --target requires a path");
      }
      target = next;
      i += 1;
    } else if (arg && arg.startsWith("--target=")) {
      target = arg.slice("--target=".length);
    } else if (arg) {
      throw new Error(`agentline config init: unknown argument '${arg}'`);
    }
  }
  const resolvedPreset: InitPreset = preset ?? "default";
  const out: InitCommandArgs = { preset: resolvedPreset, force };
  if (target !== undefined) (out as { target: string }).target = target;
  return out;
}

function assertPreset(value: string): asserts value is InitPreset {
  if (!PRESETS.has(value as InitPreset)) {
    throw new Error(
      `agentline config init: unknown preset '${value}' (expected minimal|default|maximal)`,
    );
  }
}

function defaultTemplateDir(): string {
  // Templates ship under `templates/` at the package root; cli.mjs
  // lives at `dist/cli.mjs`, so the path is `../templates/`.
  const cliDir = dirname(fileURLToPath(import.meta.url));
  return join(cliDir, "..", "templates");
}
