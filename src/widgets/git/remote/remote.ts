/**
 * `git-origin-repo` and `git-upstream` widgets (§7.6).
 *
 *   - `git-origin-repo` renders the parsed `origin` remote's repo
 *     segment; hidden when there's no `origin` remote configured.
 *   - `git-upstream` renders the upstream tracking ref
 *     (e.g., `origin/main`); hidden without one.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";

interface OwnerOptions {
  readonly label?: string;
}

interface UpstreamOptions {
  readonly label?: string;
}

export const gitOriginRepoWidget = defineWidget<OwnerOptions>(
  "git-origin-repo",
  (ctx, settings): Cell => {
    const s = ctx.git && ctx.git.available ? ctx.git : null;
    if (!s || !s.origin) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${s.origin.repo}` };
  },
);

export const gitUpstreamWidget = defineWidget<UpstreamOptions>(
  "git-upstream",
  (ctx, settings): Cell => {
    const s = ctx.git && ctx.git.available ? ctx.git : null;
    if (!s || !s.upstream) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${s.upstream}` };
  },
);
