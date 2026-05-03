/**
 * Body for `agentline preview` — the headline "first 30 seconds" command.
 *
 * Renders a representative statusline against a built-in stdin payload
 * so a user can see the tool work with one invocation, no install, no
 * host session, no piping. The pipeline routes through
 * `renderForFixture` so what `preview` shows is byte-equivalent to what
 * the live render path produces (modulo the stdin payload).
 *
 *   - default                render with built-in defaults
 *   - --theme <name>         render with a named theme (user dir + builtin)
 *   - --all-themes           stack one render per shipped theme
 *   - --config <path>        preview against a specific config file
 *   - --minimal | --default  preview the shipped templates without writing them
 *   - --no-color/--ascii/... accessibility flags (forwarded to the render)
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { listThemesIn, loadTheme, ThemeLoadError, type Theme } from "../theme/index.js";
import { resolveConfigPaths } from "../config/paths.js";
import {
  parseAccessibilityArgs,
  type AccessibilityFlags,
} from "../render/accessibility.js";
import { renderForFixture } from "../render/fixture-runner.js";

import { PREVIEW_SAMPLE_PAYLOAD } from "./sample.js";

const HELP = `agentline preview — render a sample statusline (no install, no stdin)

Usage:
  agentline preview [--theme <name>] [--config <path>] [--all-themes]
                    [--minimal | --default] [--no-color | --ascii ...]

Options:
  --theme <name>       render with the named theme (user dir or builtin)
  --all-themes         stack one render per shipped theme
  --config <path>      render against a specific config file
  --minimal            preview the shipped minimal template
  --default            preview the shipped default template
  --no-color, --ascii  forward accessibility flags to the renderer
  -h, --help           show this message

With no flags, preview uses the user's saved config when present, else
falls back to the shipped default template so a fresh install renders
a rich demo bar.
`;

export type PreviewMode = "single" | "all-themes";
export type PreviewTemplate = "minimal" | "default";

export interface PreviewCommandArgs {
  readonly mode: PreviewMode;
  readonly theme?: string;
  readonly configPath?: string;
  readonly template?: PreviewTemplate;
  readonly accessibility: AccessibilityFlags;
}

export interface PreviewInput {
  readonly args: PreviewCommandArgs;
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
  /** Override builtin themes dir; primarily used by tests. */
  readonly builtinDir?: string;
  /** Override builtin templates dir; primarily used by tests. */
  readonly templateDir?: string;
}

const ACCESSIBILITY_FLAGS: ReadonlySet<string> = new Set([
  "--no-color",
  "--no-colour",
  "--no-unicode",
  "--ascii",
]);

export async function runPreviewCommand(input: PreviewInput): Promise<number> {
  const env = input.env ?? process.env;

  const configPath = await resolveConfigPath(input);

  if (input.args.mode === "all-themes") {
    return renderAllThemes(input, configPath);
  }

  const theme = input.args.theme ? await loadThemeByName(input, input.args.theme) : null;

  const out = await renderForFixture(PREVIEW_SAMPLE_PAYLOAD, {
    ...(configPath !== undefined ? { configPath } : {}),
    ...(theme !== null ? { theme } : {}),
    flags: input.args.accessibility,
    env,
  });
  process.stdout.write(out);
  emitTtyCaption(theme?.name, configPath);
  return 0;
}

async function renderAllThemes(
  input: PreviewInput,
  configPath: string | undefined,
): Promise<number> {
  const env = input.env ?? process.env;
  const dirs = themeDirectories(input);
  const seen = new Set<string>();
  const themes: { name: string; path: string }[] = [];
  for (const dir of dirs) {
    if (!(await pathExists(dir))) continue;
    const listing = await listThemesIn(dir);
    for (const t of listing.themes) {
      if (seen.has(t.name)) continue;
      seen.add(t.name);
      themes.push(t);
    }
  }
  if (themes.length === 0) {
    process.stderr.write("agentline preview: no themes found on the search path\n");
    return 1;
  }
  for (const t of themes) {
    const theme = await loadTheme(t.path);
    const out = await renderForFixture(PREVIEW_SAMPLE_PAYLOAD, {
      ...(configPath !== undefined ? { configPath } : {}),
      theme,
      flags: input.args.accessibility,
      env,
    });
    process.stdout.write(`${t.name}:\n${out}`);
  }
  return 0;
}

async function resolveConfigPath(input: PreviewInput): Promise<string | undefined> {
  if (input.args.configPath) return input.args.configPath;
  if (input.args.template) {
    return resolveTemplatePath(input, input.args.template);
  }
  // No explicit choice: prefer the user's saved config so `agentline preview`
  // doubles as "show me what my real bar looks like". Fall back to the
  // shipped default template so a brand-new install still has a rich demo
  // instead of the bare DEFAULT_CONFIG (model-only).
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const userConfig = resolveConfigPaths(env, cwd).userConfig;
  if (await pathExists(userConfig)) return userConfig;
  return resolveTemplatePath(input, "default");
}

async function resolveTemplatePath(
  input: PreviewInput,
  template: PreviewTemplate,
): Promise<string> {
  const dir = input.templateDir ?? defaultTemplateDir();
  const file = template === "minimal" ? "minimal.config.json" : "default.config.json";
  const path = join(dir, file);
  if (!(await pathExists(path))) {
    throw new Error(`agentline preview: template ${file} not found`);
  }
  return path;
}

async function loadThemeByName(input: PreviewInput, name: string): Promise<Theme> {
  const dirs = themeDirectories(input);
  for (const dir of dirs) {
    const path = join(dir, `${name}.json`);
    if (!(await pathExists(path))) continue;
    return loadTheme(path);
  }
  throw new ThemeLoadError(`theme '${name}' not found on the search path`);
}

function themeDirectories(input: PreviewInput): readonly string[] {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const userThemes = join(resolveConfigPaths(env, cwd).userDir, "themes");
  const builtin = input.builtinDir ?? defaultBuiltinDir();
  return [userThemes, builtin];
}

function defaultBuiltinDir(): string {
  // Themes ship under `themes/` at the package root; cli.mjs lives at
  // `dist/cli.mjs` so the relative path is `../themes/`.
  const cliDir = dirname(fileURLToPath(import.meta.url));
  return join(cliDir, "..", "themes");
}

function defaultTemplateDir(): string {
  const cliDir = dirname(fileURLToPath(import.meta.url));
  return join(cliDir, "..", "templates");
}

function emitTtyCaption(themeName: string | undefined, configPath: string | undefined): void {
  if (!process.stderr.isTTY) return;
  const themeLabel = themeName ?? "built-in defaults";
  const configLabel = configPath ?? "built-in DEFAULT_CONFIG";
  process.stderr.write(
    `# preview — theme: ${themeLabel}, config: ${configLabel}\n` +
      `# next: agentline init  (save a config)  |  agentline doctor --fix  (wire the host)\n`,
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export function parsePreviewArgs(rest: readonly string[]): PreviewCommandArgs {
  let mode: PreviewMode = "single";
  let theme: string | undefined;
  let configPath: string | undefined;
  let template: PreviewTemplate | undefined;
  const accessibilityArgv: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (isHelpFlag(arg)) {
      requestHelp(HELP);
    } else if (arg === "--all-themes") {
      mode = "all-themes";
    } else if (arg === "--theme") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline preview: --theme requires a name");
      }
      theme = next;
      i += 1;
    } else if (arg && arg.startsWith("--theme=")) {
      theme = arg.slice("--theme=".length);
    } else if (arg === "--config") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline preview: --config requires a path");
      }
      configPath = next;
      i += 1;
    } else if (arg && arg.startsWith("--config=")) {
      configPath = arg.slice("--config=".length);
    } else if (arg === "--minimal") {
      template = "minimal";
    } else if (arg === "--default") {
      template = "default";
    } else if (arg && ACCESSIBILITY_FLAGS.has(arg)) {
      accessibilityArgv.push(arg);
    } else if (arg) {
      throw new Error(`agentline preview: unknown argument '${arg}'`);
    }
  }
  if (configPath !== undefined && template !== undefined) {
    throw new Error("agentline preview: --config and --minimal/--default are mutually exclusive");
  }
  const accessibility = parseAccessibilityArgs(accessibilityArgv);
  const out: PreviewCommandArgs = { mode, accessibility };
  if (theme !== undefined) (out as { theme: string }).theme = theme;
  if (configPath !== undefined) (out as { configPath: string }).configPath = configPath;
  if (template !== undefined) (out as { template: PreviewTemplate }).template = template;
  return out;
}
