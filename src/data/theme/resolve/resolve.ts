/**
 * Bridge `config.theme` (a theme *name*) to a loaded `Theme` for the render
 * path (§5.4, §8.2).
 *
 * The render pipeline (`renderFromInputs`) takes a `Theme | null`, but the
 * on-disk config only records a name. This module walks the same search path
 * the theme browser uses — the user `themes/` directory first, then the
 * bundled `themes/` — loads the first match, and falls back to `null` on any
 * miss or parse error. A stale or mistyped theme name must never fail a
 * render.
 *
 * No network I/O; theme files are read read-only (§1.2 N5, N6).
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveConfigPaths } from "../../config/paths/paths.js";
import { pathExists } from "../../../core/lib/fs/fs.js";

import { loadTheme, type Theme } from "../index.js";

export interface ThemeResolveOptions {
  readonly env?: NodeJS.ProcessEnv;
  /** Override the bundled themes directory; primarily used by tests. */
  readonly builtinDir?: string;
}

/** Themes search path: the user `themes/` directory first, then the bundled one. */
export function themeDirectories(opts: ThemeResolveOptions = {}): readonly string[] {
  const env = opts.env ?? process.env;
  const userThemes = join(resolveConfigPaths(env).userDir, "themes");
  const builtin = opts.builtinDir ?? defaultBuiltinThemesDir();
  return [userThemes, builtin];
}

/**
 * `themes/` at the package root. `cli.mjs` / `tui.mjs` are emitted into
 * `dist/`, so the bundled themes sit one level up.
 */
export function defaultBuiltinThemesDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "themes");
}

/*
 * Theme files are named `<name>.json`; reject anything path-shaped so a stale
 * `theme: "../../secrets"` can't resolve outside the search path.
 */
const SAFE_THEME_NAME = /^[a-zA-Z0-9._-]+$/;

/**
 * Load the theme named `name`, or `null` when `name` is empty, path-shaped,
 * not found on the search path, or fails to parse. Never throws.
 */
export async function resolveConfiguredTheme(
  name: string | null | undefined,
  opts: ThemeResolveOptions = {},
): Promise<Theme | null> {
  if (!name || !SAFE_THEME_NAME.test(name) || name.startsWith(".")) return null;
  for (const dir of themeDirectories(opts)) {
    const themePath = join(dir, `${name}.json`);
    if (!(await pathExists(themePath))) continue;
    try {
      return await loadTheme(themePath);
    } catch {
      return null;
    }
  }
  return null;
}
