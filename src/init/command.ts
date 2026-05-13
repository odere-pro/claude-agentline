/**
 * Body for `agentline init` (§9.1, §10).
 *
 * Scaffolds the user config file from the shipped default template.
 * Idempotent: refuses to overwrite an existing target unless `--force`
 * is passed. Atomic write via the existing helper.
 *
 * agentline is configured globally only — the target is always
 * `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`.
 *
 * Flag surface:
 *   --force           overwrite an existing config
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
import { projectGate } from "../lib/claude-project.js";
import { resolveEnv } from "../lib/env.js";
import { pathExists } from "../lib/fs.js";

const HELP = `agentline init — write the default user config

Usage:
  agentline init [--force]

Options:
  --force             overwrite an existing config
  -h, --help          show this message

The config is written to \`\${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json\`.
After writing, the command prints next-step hints for verify + doctor.
`;

const TEMPLATE_FILE = "default.config.json";

export interface InitCommandArgs {
  readonly force: boolean;
}

export interface InitInput {
  readonly args: InitCommandArgs;
  readonly env?: NodeJS.ProcessEnv;
  /** Override target path; primarily used by tests. */
  readonly target?: string;
  /** Override template directory; primarily used by tests. */
  readonly templateDir?: string;
  /** Cwd the project-gate probes. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** Stdin override for the project-gate prompt; tests inject a PassThrough. */
  readonly stdin?: NodeJS.ReadableStream & { readonly isTTY?: boolean };
}

export async function runInitCommand(input: InitInput): Promise<number> {
  const env = resolveEnv(input);
  const gate = await projectGate({
    command: "init",
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
    ...(input.stdin !== undefined ? { stdin: input.stdin } : {}),
  });
  if (gate === "skip") return 0;
  const target = input.target ?? resolveConfigPaths(env).userConfig;
  const templateDir = input.templateDir ?? defaultTemplateDir();
  const templatePath = join(templateDir, TEMPLATE_FILE);

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
      `agentline: wrote ${target}`,
      `  verify: agentline doctor`,
      `  wire it up: agentline doctor --fix`,
      "",
    ].join("\n"),
  );
  return 0;
}

export function parseInitArgs(rest: readonly string[]): InitCommandArgs {
  let force = false;
  for (const arg of rest) {
    if (isHelpFlag(arg)) {
      requestHelp(HELP);
    } else if (arg === "--force") {
      force = true;
    } else if (arg) {
      throw new Error(`agentline init: unknown argument '${arg}'`);
    }
  }
  return { force };
}

function defaultTemplateDir(): string {
  // Templates ship under `templates/` at the package root; cli.mjs
  // lives at `dist/cli.mjs`, so the path is `../templates/`.
  const cliDir = dirname(fileURLToPath(import.meta.url));
  return join(cliDir, "..", "templates");
}
