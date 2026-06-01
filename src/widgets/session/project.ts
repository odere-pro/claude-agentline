/**
 * `project` widget (§7.2). Shows the project the session is in.
 *
 * Git-aware: prefers the repository's canonical name from the `origin`
 * remote (then `upstream`), falling back to the working-directory folder
 * name. `ctx.git` is resolved once per render tick by `loadGitSnapshot`;
 * this widget only consumes the frozen snapshot — no shell-out, no I/O.
 *
 * Fallback note: a remote-less repo opened in a subdirectory resolves to
 * the subdirectory folder name — the snapshot exposes `cwd`, not the repo
 * toplevel. The remote-based path covers the common case. Hidden when
 * neither a remote name nor a cwd basename resolves.
 */

import { defineWidget } from "../widget.js";
import type { WidgetContext } from "../types.js";

interface ProjectOptions {
  readonly label?: string;
}

/** Last path segment, cross-platform (handles `/` and `\`, trims trailing seps). */
export function pathBasename(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, "");
  if (trimmed === "") return "";
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] ?? "";
}

function resolveProjectName(ctx: WidgetContext): string {
  const git = ctx.git;
  if (git?.available) {
    if (git.origin?.repo) return git.origin.repo;
    if (git.upstreamRemote?.repo) return git.upstreamRemote.repo;
    const base = pathBasename(git.cwd);
    if (base) return base;
  }
  return ctx.stdin.cwd ? pathBasename(ctx.stdin.cwd) : "";
}

export const projectWidget = defineWidget<ProjectOptions>("project", (ctx, settings) => {
  const name = resolveProjectName(ctx);
  if (!name) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${name}` };
});
