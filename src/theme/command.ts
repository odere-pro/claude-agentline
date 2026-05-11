/**
 * Body for `agentline config theme [--list | --show <name> | --set <name>]` (§9.1, §5.6).
 *
 *   - default              swatch table — name + 13 colour blocks per palette,
 *                          rendered with terminal colour-depth detection.
 *   - `--list`             tab-separated `name<TAB>path` rows, machine-readable
 *                          for scripts and CI.
 *   - `--show <name>`      pretty-prints the resolved palette for one
 *                          theme. Useful when authoring overrides or filing
 *                          a colour bug.
 *   - `--set <name>`       writes `theme: "<name>"` into the user or project
 *                          config via the same atomic-write path used by
 *                          `agentline config init`. Idempotent.
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { atomicWriteJson } from "../config/atomic.js";
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

const HELP = `agentline config theme — browse, inspect, and pick a theme

Usage:
  agentline config theme                       # swatch table of all themes
  agentline config theme --list                # machine-readable name<TAB>path
  agentline config theme --show <name>         # inspect one theme's palette
  agentline config theme --set <name>          # write theme into your config

Options:
  --list             tab-separated name<TAB>path rows (machine-readable)
  --show <name>      pretty-print one theme's resolved palette
  --set <name>       set \`theme: "<name>"\` in your config (atomic write)
  --scope <where>    user | project (default: project if \`.agentline.json\`
                     exists in cwd, else user). Pairs with --set.
  -h, --help         show this message

Workflow:
  1. Browse themes:  agentline config theme
  2. Pick one:       agentline config theme --set vscode-dark
  3. Verify wiring:  agentline doctor
`;

export type ThemesAction = "table" | "list" | "show" | "set";
export type ThemesScope = "user" | "project";

const SCOPES: ReadonlySet<ThemesScope> = new Set(["user", "project"]);

export interface ThemesCommandArgs {
  readonly action: ThemesAction;
  readonly name?: string;
  readonly scope?: ThemesScope;
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
  if (input.args.action === "set") return setTheme(input);
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
    "\nPick one: `agentline config theme --set <name>` — verify with `agentline doctor`.\n",
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

async function setTheme(input: ThemesInput): Promise<number> {
  const name = input.args.name;
  if (!name) {
    process.stderr.write("agentline config theme: --set requires a theme name\n");
    return 2;
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(name) || name.startsWith(".")) {
    process.stderr.write(`agentline config theme: invalid theme name '${name}'\n`);
    return 2;
  }

  // Validate the theme exists on the search path before mutating any file.
  const { rows } = await collectThemes(input);
  if (!rows.some((r) => r.name === name)) {
    process.stderr.write(
      `agentline config theme: theme '${name}' not found — run \`agentline config theme --list\`\n`,
    );
    return 1;
  }

  const env = resolveEnv(input);
  const cwd = input.cwd ?? process.cwd();
  const targetPath = await resolveSetTarget(input.args.scope, env, cwd);

  let existing: Record<string, unknown> | undefined;
  if (await pathExists(targetPath)) {
    let body: string;
    try {
      body = await fs.readFile(targetPath, "utf8");
    } catch (err) {
      process.stderr.write(
        `agentline config theme: unable to read ${targetPath}: ${(err as Error).message}\n`,
      );
      return 1;
    }
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("config root must be a JSON object");
      }
      existing = parsed as Record<string, unknown>;
    } catch (err) {
      process.stderr.write(
        `agentline config theme: ${targetPath} is not valid JSON (${(err as Error).message}); refusing to overwrite\n`,
      );
      return 1;
    }
  }

  const next: Record<string, unknown> = existing
    ? { ...existing, theme: name }
    : { version: 1, theme: name };

  try {
    await atomicWriteJson(targetPath, next, { mode: 0o644 });
  } catch (err) {
    process.stderr.write(
      `agentline config theme: failed to write ${targetPath}: ${(err as Error).message}\n`,
    );
    return 1;
  }

  process.stdout.write(`agentline: set theme to ${name} in ${targetPath}\n`);
  return 0;
}

async function resolveSetTarget(
  scope: ThemesScope | undefined,
  env: NodeJS.ProcessEnv,
  cwd: string,
): Promise<string> {
  const paths = resolveConfigPaths(env, cwd);
  if (scope === "user") return paths.userConfig;
  if (scope === "project") return paths.projectConfig;
  // Default: project if a .agentline.json sits in cwd, else user. This mirrors
  // how most users iterate — local-first for a tracked project, else the home
  // config for one-off shell setups.
  return (await pathExists(paths.projectConfig)) ? paths.projectConfig : paths.userConfig;
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
  let scope: ThemesScope | undefined;
  const setActions = new Set<ThemesAction>();
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (isHelpFlag(arg)) requestHelp(HELP);
    else if (arg === "--list") {
      action = "list";
      setActions.add("list");
    } else if (arg === "--show") {
      action = "show";
      setActions.add("show");
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline config theme: --show requires a theme name");
      }
      name = next;
      i += 1;
    } else if (arg && arg.startsWith("--show=")) {
      action = "show";
      setActions.add("show");
      name = arg.slice("--show=".length);
    } else if (arg === "--set") {
      action = "set";
      setActions.add("set");
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline config theme: --set requires a theme name");
      }
      name = next;
      i += 1;
    } else if (arg && arg.startsWith("--set=")) {
      action = "set";
      setActions.add("set");
      name = arg.slice("--set=".length);
    } else if (arg === "--scope") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline config theme: --scope requires one of user|project");
      }
      assertThemesScope(next);
      scope = next;
      i += 1;
    } else if (arg && arg.startsWith("--scope=")) {
      const value = arg.slice("--scope=".length);
      assertThemesScope(value);
      scope = value;
    } else if (arg) {
      throw new Error(`agentline config theme: unknown argument '${arg}'`);
    }
  }
  if (setActions.size > 1) {
    throw new Error(
      "agentline config theme: --list, --show, and --set are mutually exclusive",
    );
  }
  if (scope !== undefined && action !== "set") {
    throw new Error("agentline config theme: --scope only applies to --set");
  }
  const out: ThemesCommandArgs = { action };
  if (name !== undefined) (out as { name: string }).name = name;
  if (scope !== undefined) (out as { scope: ThemesScope }).scope = scope;
  return out;
}

function assertThemesScope(value: string): asserts value is ThemesScope {
  if (!SCOPES.has(value as ThemesScope)) {
    throw new Error(
      `agentline config theme: unknown scope '${value}' (expected user|project)`,
    );
  }
}
