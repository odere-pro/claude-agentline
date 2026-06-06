/**
 * `agentline config init [--preset <name>] [--force]`
 *
 * Seeds the user config from a named config template
 * (`templates/<name>.config.json`). Mirrors the "don't clobber a
 * user-edited config without --force" pattern from `agentline reset`.
 *
 * The `--preset` flag names one of the shipped config templates:
 * `default` (balanced), `minimal` (lean single-line), `power` (rich).
 *
 * Flow:
 *   1. Resolve template name → template path; unknown → error + list.
 *   2. Read + validate the config template JSON.
 *   3. If a user config already exists, refuse unless --force.
 *   4. Atomic write to the user config path.
 *
 * Writes always go through `writeJsonIdempotent` (write-temp → fsync →
 * rename). Validation runs BEFORE writing — a bad config template never
 * reaches disk.
 */

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

import { isHelpFlag, requestHelp } from "../../../core/lib/help/help.js";
import { resolveEnv } from "../../../core/lib/env/env.js";
import { resolveConfigPaths } from "../paths/paths.js";
import { validateConfig } from "../validate/validate.js";
import { writeJsonIdempotent } from "../../../core/lib/atomic-write/atomic-write.js";
import { pathExists } from "../../../core/lib/fs/fs.js";
import { stripPrototypeKeys } from "../../../core/lib/strip-prototype-keys/strip-prototype-keys.js";

const PREFIX = "agentline config init";

const HELP = `agentline config init — seed the user config from a config template

Usage:
  agentline config init [--preset <name>] [--force]

Seeds the user config (~/.config/agentline/config.json) from one of the
shipped config templates. If a config already exists the command refuses
unless --force is supplied.

Config templates:
  default   Balanced three-line layout (model · git · tokens · rate-limits)
  minimal   Lean single-line bar (model · context-percentage · git-branch)
  power     Rich four-line bar showcasing every widget family

Options:
  --preset <name>   config template to seed from (default: default)
  --force           overwrite an existing user config
  -h, --help        show this message
`;

/** Ordered list of config template names that correspond to \`templates/<name>.config.json\`. */
export const AVAILABLE_PRESETS: readonly string[] = Object.freeze([
  "default",
  "minimal",
  "power",
]);

export interface InitArgs {
  readonly preset: string;
  readonly force: boolean;
}

export interface InitInput {
  readonly args: InitArgs;
  readonly env?: NodeJS.ProcessEnv;
}

export function parseInitArgs(rest: readonly string[]): InitArgs {
  let preset = "default";
  let force = false;

  let i = 0;
  while (i < rest.length) {
    const arg = rest[i]!;
    if (isHelpFlag(arg)) requestHelp(HELP);
    if (arg === "--force") {
      force = true;
      i += 1;
      continue;
    }
    if (arg === "--preset") {
      const val = rest[i + 1];
      if (val === undefined || val.startsWith("-")) {
        throw new Error(`${PREFIX}: --preset requires a value`);
      }
      preset = val;
      i += 2;
      continue;
    }
    if (arg.startsWith("--preset=")) {
      preset = arg.slice("--preset=".length);
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`${PREFIX}: unknown option '${arg}'`);
    }
    // positional — not expected
    throw new Error(`${PREFIX}: unexpected argument '${arg}'`);
  }

  return { preset, force };
}

/**
 * Resolve the absolute path to the repo's `templates/` directory.
 *
 * The bundle is emitted as `dist/cli.mjs` (all source merged into one
 * file). At that point `import.meta.url` points to `dist/cli.mjs`, so
 * `templates/` is one directory up (`<repo-root>/templates/`).
 *
 * During tests (vitest runs source directly via tsx), `import.meta.url`
 * points to `src/data/config/init/init-command.ts`; from there
 * `templates/` is four directories up. We detect the context by
 * checking whether the current file is inside a `src/` subtree.
 */
function resolveTemplatesDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = dirname(thisFile);
  // src/ tree: go up 4 levels (init → config → data → src → repo-root)
  if (thisDir.includes("/src/") || thisDir.includes("\\src\\")) {
    return resolve(thisDir, "..", "..", "..", "..", "templates");
  }
  // compiled dist/ tree: go up 1 level from the dist/ directory
  return resolve(thisDir, "..", "templates");
}

export async function runInitCommand(input: InitInput): Promise<number> {
  const env = resolveEnv(input);
  const paths = resolveConfigPaths(env);

  // 1. Validate config template name
  if (!AVAILABLE_PRESETS.includes(input.args.preset)) {
    process.stderr.write(
      `${PREFIX}: unknown config template '${input.args.preset}'\n` +
        `available config templates: ${AVAILABLE_PRESETS.join(", ")}\n`,
    );
    return 1;
  }

  // 2. Load and validate the config template
  const templatesDir = resolveTemplatesDir();
  const templatePath = join(templatesDir, `${input.args.preset}.config.json`);

  let templateJson: unknown;
  try {
    const text = await fs.readFile(templatePath, "utf8");
    templateJson = stripPrototypeKeys(JSON.parse(text));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${PREFIX}: failed to read config template '${templatePath}': ${msg}\n`);
    return 1;
  }

  // Validate BEFORE writing — a bad template must never reach disk
  try {
    validateConfig(templateJson);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${PREFIX}: config template '${input.args.preset}' failed schema validation: ${msg}\n`);
    return 1;
  }

  // 3. Overwrite-gate: refuse if user config already exists and --force not set
  const exists = await pathExists(paths.userConfig);
  if (exists && !input.args.force) {
    process.stderr.write(
      `${PREFIX}: ${paths.userConfig} already exists — use --force to overwrite\n`,
    );
    return 1;
  }

  // 4. Atomic write
  await writeJsonIdempotent(paths.userConfig, templateJson);

  const verb = exists ? "overwritten" : "seeded";
  process.stdout.write(
    `agentline: config ${verb} from '${input.args.preset}' config template → ${paths.userConfig}\n`,
  );
  return 0;
}

export async function runInitSubgroup(rest: readonly string[]): Promise<number> {
  return runInitCommand({ args: parseInitArgs(rest) });
}
