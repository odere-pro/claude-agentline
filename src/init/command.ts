/**
 * Body for `agentline init [--minimal]` (§9.1, §10).
 *
 * Scaffolds the project config (`${CLAUDE_PROJECT_DIR}/.agentline.json`)
 * from the shipped template. Idempotent: refuses to overwrite an
 * existing file unless `--force` is passed. Atomic write —
 * write-temp + fsync + rename via the existing helper.
 *
 * Two templates ship in the package: `templates/default.config.json`
 * (full default widget list per §7.10) and `templates/minimal.config.json`
 * (smaller starter). `--minimal` selects the latter.
 */

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { atomicWrite } from "../config/atomic.js";
import { resolveConfigPaths } from "../config/paths.js";

export interface InitCommandArgs {
  readonly minimal: boolean;
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
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const target = input.args.target ?? resolveConfigPaths(env, cwd).projectConfig;
  const templateDir = input.templateDir ?? defaultTemplateDir();
  const templateFile = input.args.minimal ? "minimal.config.json" : "default.config.json";
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
      `agentline init: unable to read template ${templatePath}: ${(err as Error).message}\n`,
    );
    return 1;
  }
  await atomicWrite(target, body, { mode: 0o644 });
  process.stdout.write(`agentline: wrote ${target} (template: ${templateFile})\n`);
  return 0;
}

export function parseInitArgs(rest: readonly string[]): InitCommandArgs {
  let minimal = false;
  let force = false;
  let target: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--minimal") minimal = true;
    else if (arg === "--force") force = true;
    else if (arg === "--target") {
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
  return target !== undefined ? { minimal, force, target } : { minimal, force };
}

function defaultTemplateDir(): string {
  // Templates ship under `templates/` at the package root; cli.mjs
  // lives at `dist/cli.mjs`, so the path is `../templates/`.
  const cliDir = dirname(fileURLToPath(import.meta.url));
  return join(cliDir, "..", "templates");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
