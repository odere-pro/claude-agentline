/**
 * `project-dir` widget (session family).
 *
 * Renders the launch directory from `ctx.stdin.projectDir` (the host's
 * `workspace.project_dir`) — the dir the host was started in. By
 * default shows the basename; `options.full` shows the whole path.
 *
 * Distinct from `project` (git repo *name*, origin-remote-aware) and
 * `cwd-path` (the *current* dir, which can differ after a `cd`). Hidden
 * when absent. Pure `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import { pathBasename } from "../project.js";
import type { WidgetContext } from "../../types.js";

interface ProjectDirOptions {
  readonly label?: string;
  /** Render the full path instead of just the basename. */
  readonly full?: boolean;
}

export const projectDirWidget = defineWidget<ProjectDirOptions>(
  "project-dir",
  (ctx: WidgetContext, settings): Cell => {
    const dir = ctx.stdin.projectDir;
    if (!dir) return { text: "", hidden: true };
    const shown = settings.options.full ? dir : pathBasename(dir);
    if (!shown) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${shown}` };
  },
);
