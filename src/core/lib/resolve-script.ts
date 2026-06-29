/**
 * Resolve a `scripts/<name>` path relative to the built CLI bundle.
 *
 * `install`, `start`, `reset`, and `uninstall` all delegate to a bash
 * script shipped alongside `dist/`. They each used to carry a private
 * copy of this resolver; `start`, `reset`, and `install` now share this
 * one. (`uninstall` still keeps a private copy — a candidate for the
 * same consolidation.) The `command` label only shapes the not-found
 * error message so the hint names the right subcommand.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveScript(name: string, command: string): string {
  const cliDir = dirname(fileURLToPath(import.meta.url));
  const path = join(cliDir, "..", "scripts", name);
  if (!existsSync(path)) {
    throw new Error(
      `agentline ${command}: script not found at ${path}\n` +
        "  This command requires the agentline repository checkout.\n" +
        "  Clone https://github.com/odere-pro/claude-agentline and run from there.",
    );
  }
  return path;
}
