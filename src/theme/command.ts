/**
 * Body for `agentline themes [--list | --show <name>]` (§9.1, §5.6).
 *
 *   - `--list` (default when no flag is set): enumerates the four
 *     shipped themes (vscode-dark, vscode-light, claude-code-dark,
 *     claude-code-light) plus any extras the user has dropped into
 *     `${CLAUDE_CONFIG_DIR}/agentline/themes/`.
 *   - `--show <name>`: pretty-prints the resolved palette for one
 *     theme. Useful when authoring overrides or filing a colour bug.
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { resolveConfigPaths } from "../config/paths.js";
import { listThemesIn, loadTheme, THEME_ROLES } from "./index.js";

const HELP = `agentline themes — inspect installed theme presets

Usage:
  agentline themes [--list | --show <name>]

Options:
  --list         list theme names + paths (default)
  --show <name>  pretty-print one theme's resolved palette
  -h, --help     show this message
`;

export type ThemesAction = "list" | "show";

export interface ThemesCommandArgs {
  readonly action: ThemesAction;
  readonly name?: string;
}

export interface ThemesInput {
  readonly args: ThemesCommandArgs;
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
  /** Override builtin themes dir; primarily used by tests. */
  readonly builtinDir?: string;
}

export async function runThemesCommand(input: ThemesInput): Promise<number> {
  if (input.args.action === "show") {
    return showTheme(input);
  }
  return listAllThemes(input);
}

async function listAllThemes(input: ThemesInput): Promise<number> {
  const dirs = themeDirectories(input);
  const seen = new Set<string>();
  const rows: { name: string; path: string }[] = [];
  const errors: { path: string; message: string }[] = [];
  for (const dir of dirs) {
    const exists = await pathExists(dir);
    if (!exists) continue;
    const listing = await listThemesIn(dir);
    for (const t of listing.themes) {
      if (seen.has(t.name)) continue;
      seen.add(t.name);
      rows.push(t);
    }
    errors.push(...listing.errors);
  }
  if (rows.length === 0) {
    process.stderr.write("agentline themes: no themes found on the search path\n");
    return 1;
  }
  for (const row of rows) {
    process.stdout.write(`${row.name}\t${row.path}\n`);
  }
  for (const err of errors) {
    process.stderr.write(`agentline themes: ${err.path}: ${err.message}\n`);
  }
  return 0;
}

async function showTheme(input: ThemesInput): Promise<number> {
  const name = input.args.name;
  if (!name) {
    process.stderr.write("agentline themes: --show requires a theme name\n");
    return 2;
  }
  const dirs = themeDirectories(input);
  for (const dir of dirs) {
    const path = join(dir, `${name}.json`);
    if (!(await pathExists(path))) continue;
    try {
      const theme = await loadTheme(path);
      process.stdout.write(formatTheme(theme.name, path, theme.palette));
      return 0;
    } catch (err) {
      process.stderr.write(
        `agentline themes: ${path}: ${(err as Error).message}\n`,
      );
      return 1;
    }
  }
  process.stderr.write(`agentline themes: theme '${name}' not found\n`);
  return 1;
}

function formatTheme(
  name: string,
  path: string,
  palette: Readonly<Record<string, string>>,
): string {
  const lines = [`theme: ${name}`, `path:  ${path}`, "palette:"];
  const widest = THEME_ROLES.reduce((n, r) => Math.max(n, r.length), 0);
  for (const role of THEME_ROLES) {
    const colour = palette[role] ?? "(unset)";
    lines.push(`  ${role.padEnd(widest, " ")}  ${colour}`);
  }
  lines.push("");
  return lines.join("\n");
}

function themeDirectories(input: ThemesInput): readonly string[] {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const userThemes = join(resolveConfigPaths(env, cwd).userDir, "themes");
  const builtin = input.builtinDir ?? defaultBuiltinDir();
  return [userThemes, builtin];
}

function defaultBuiltinDir(): string {
  // Themes ship under `themes/` at the package root; cli.mjs lives
  // at `dist/cli.mjs` so the path is `../themes/`.
  const cliDir = dirname(fileURLToPath(import.meta.url));
  return join(cliDir, "..", "themes");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export function parseThemesArgs(rest: readonly string[]): ThemesCommandArgs {
  let action: ThemesAction = "list";
  let name: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (isHelpFlag(arg)) requestHelp(HELP);
    else if (arg === "--list") action = "list";
    else if (arg === "--show") {
      action = "show";
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline themes: --show requires a theme name");
      }
      name = next;
      i += 1;
    } else if (arg && arg.startsWith("--show=")) {
      action = "show";
      name = arg.slice("--show=".length);
    } else if (arg) {
      throw new Error(`agentline themes: unknown argument '${arg}'`);
    }
  }
  return name !== undefined ? { action, name } : { action };
}
