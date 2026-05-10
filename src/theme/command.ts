/**
 * Body for `agentline config theme [--list | --show <name>]` (§9.1, §5.6).
 *
 *   - default              swatch table — name + 13 colour blocks per palette,
 *                          rendered with terminal colour-depth detection.
 *   - `--list`             tab-separated `name<TAB>path` rows, machine-readable
 *                          for scripts and CI.
 *   - `--show <name>`      pretty-prints the resolved palette for one
 *                          theme. Useful when authoring overrides or filing
 *                          a colour bug.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { resolveEnv } from "../lib/env.js";
import { pathExists } from "../lib/fs.js";
import { resolveConfigPaths } from "../config/paths.js";
import { detectColourDepth } from "../render/colour-depth.js";
import { encodeSegments, SGR_RESET } from "../render/ansi.js";
import type { Segment } from "../render/segment.js";
import {
  isColour,
  listThemesIn,
  loadTheme,
  resolveRole,
  THEME_ROLES,
  type Theme,
} from "./index.js";

const HELP = `agentline config theme — browse and inspect theme presets

Usage:
  agentline config theme [--list | --show <name>]

Options:
  --list         tab-separated name<TAB>path rows (machine-readable)
  --show <name>  pretty-print one theme's resolved palette
  -h, --help     show this message

With no flags, prints a swatch table — name + the 13 palette colours
rendered as coloured blocks. Useful for picking a theme at a glance.
`;

export type ThemesAction = "table" | "list" | "show";

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
  if (input.args.action === "show") return showTheme(input);
  if (input.args.action === "list") return listAllThemes(input);
  return tableThemes(input);
}

async function listAllThemes(input: ThemesInput): Promise<number> {
  const { rows, errors } = await collectThemes(input);
  if (rows.length === 0) {
    process.stderr.write("agentline config theme: no themes found on the search path\n");
    return 1;
  }
  for (const row of rows) {
    process.stdout.write(`${row.name}\t${row.path}\n`);
  }
  for (const err of errors) {
    process.stderr.write(`agentline config theme: ${err.path}: ${err.message}\n`);
  }
  return 0;
}

async function tableThemes(input: ThemesInput): Promise<number> {
  const { rows, errors } = await collectThemes(input);
  if (rows.length === 0) {
    process.stderr.write("agentline config theme: no themes found on the search path\n");
    return 1;
  }
  const env = resolveEnv(input);
  const depth = detectColourDepth({ env });
  const widestName = rows.reduce((n, r) => Math.max(n, r.name.length), 0);
  for (const row of rows) {
    let theme: Theme;
    try {
      theme = await loadTheme(row.path);
    } catch (err) {
      errors.push({ path: row.path, message: (err as Error).message });
      continue;
    }
    const swatch = renderSwatch(theme, depth);
    process.stdout.write(`  ${row.name.padEnd(widestName, " ")}  ${swatch}\n`);
  }
  for (const err of errors) {
    process.stderr.write(`agentline config theme: ${err.path}: ${err.message}\n`);
  }
  process.stderr.write(
    "\nSet `theme` in your config to switch; run `agentline doctor` to verify.\n",
  );
  return 0;
}

async function collectThemes(
  input: ThemesInput,
): Promise<{
  rows: { name: string; path: string }[];
  errors: { path: string; message: string }[];
}> {
  const dirs = themeDirectories(input);
  const seen = new Set<string>();
  const rows: { name: string; path: string }[] = [];
  const errors: { path: string; message: string }[] = [];
  for (const dir of dirs) {
    if (!(await pathExists(dir))) continue;
    const listing = await listThemesIn(dir);
    for (const t of listing.themes) {
      if (seen.has(t.name)) continue;
      seen.add(t.name);
      rows.push(t);
    }
    errors.push(...listing.errors);
  }
  return { rows, errors };
}

function renderSwatch(theme: Theme, depth: ReturnType<typeof detectColourDepth>): string {
  if (depth === "none") {
    // Fall back to the role names as a hint. The bare role list keeps the
    // swatch column meaningful when colour is suppressed (e.g. NO_COLOR=1).
    return THEME_ROLES.map((r) => r.slice(0, 2)).join(" ");
  }
  const segments: Segment[] = [];
  for (const role of THEME_ROLES) {
    const colour = resolveRole(theme, role);
    if (!isColour(colour)) continue;
    segments.push({ text: "  ", bg: colour });
  }
  // Encode the segments and append a trailing reset so subsequent table
  // rows do not pick up the last cell's background.
  return `${encodeSegments(segments, depth)}${SGR_RESET}`;
}

async function showTheme(input: ThemesInput): Promise<number> {
  const name = input.args.name;
  if (!name) {
    process.stderr.write("agentline config theme: --show requires a theme name\n");
    return 2;
  }
  // Reject path-shaped names so `agentline config theme --show ../../etc/passwd`
  // can't resolve outside the themes search path.
  if (!/^[a-zA-Z0-9._-]+$/.test(name) || name.startsWith(".")) {
    process.stderr.write(`agentline config theme: invalid theme name '${name}'\n`);
    return 2;
  }
  const env = resolveEnv(input);
  const dirs = themeDirectories(input);
  for (const dir of dirs) {
    const path = join(dir, `${name}.json`);
    if (!(await pathExists(path))) continue;
    try {
      const theme = await loadTheme(path);
      process.stdout.write(formatTheme(theme.name, path, theme.palette, env));
      return 0;
    } catch (err) {
      process.stderr.write(`agentline config theme: ${path}: ${(err as Error).message}\n`);
      return 1;
    }
  }
  process.stderr.write(`agentline config theme: theme '${name}' not found\n`);
  return 1;
}

function formatTheme(
  name: string,
  path: string,
  palette: Readonly<Record<string, string>>,
  env: NodeJS.ProcessEnv,
): string {
  const depth = detectColourDepth({ env });
  const lines = [`theme: ${name}`, `path:  ${path}`, "palette:"];
  const widest = THEME_ROLES.reduce((n, r) => Math.max(n, r.length), 0);
  for (const role of THEME_ROLES) {
    const hex = palette[role] ?? "(unset)";
    const swatch =
      depth !== "none" && isColour(hex)
        ? `${encodeSegments([{ text: "  ", bg: hex }], depth)}${SGR_RESET} `
        : "   ";
    lines.push(`  ${role.padEnd(widest, " ")}  ${swatch}${hex}`);
  }
  lines.push("");
  return lines.join("\n");
}

function themeDirectories(input: ThemesInput): readonly string[] {
  const env = resolveEnv(input);
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

export function parseThemesArgs(rest: readonly string[]): ThemesCommandArgs {
  let action: ThemesAction = "table";
  let name: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (isHelpFlag(arg)) requestHelp(HELP);
    else if (arg === "--list") action = "list";
    else if (arg === "--show") {
      action = "show";
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline config theme: --show requires a theme name");
      }
      name = next;
      i += 1;
    } else if (arg && arg.startsWith("--show=")) {
      action = "show";
      name = arg.slice("--show=".length);
    } else if (arg) {
      throw new Error(`agentline config theme: unknown argument '${arg}'`);
    }
  }
  return name !== undefined ? { action, name } : { action };
}
