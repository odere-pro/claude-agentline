/**
 * `git-origin-repo` and `git-upstream` widgets (§7.6).
 *
 *   - `git-origin-repo` renders the repository name. Source preference:
 *     1. `ctx.stdin.workspaceRepo.name` (host-provided, no git spawn needed)
 *     2. `ctx.git.origin.repo` (parsed from the `origin` remote URL)
 *     The `owner-name` variant renders `owner/name` from the host block when
 *     both owner and name are present; hides otherwise.
 *   - `git-upstream` renders the upstream tracking ref
 *     (e.g., `origin/main`); hidden without one.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";

type GitOriginRepoVariant = "default" | "owner-name";

interface OwnerOptions {
  readonly label?: string;
  readonly variant?: GitOriginRepoVariant;
}

interface UpstreamOptions {
  readonly label?: string;
}

export const gitOriginRepoWidget = defineWidget<OwnerOptions>(
  "git-origin-repo",
  (ctx, settings): Cell => {
    const variant = settings.options.variant ?? "default";
    const label = settings.rawValue ? "" : (settings.options.label ?? "");

    // owner-name variant: renders "owner/name" exclusively from the host block.
    if (variant === "owner-name") {
      const repo = ctx.stdin.workspaceRepo;
      if (!repo?.owner || !repo?.name) return { text: "", hidden: true };
      return { text: `${label}${repo.owner}/${repo.name}` };
    }

    // default variant: prefer host name, fall back to origin.repo.
    const hostName = ctx.stdin.workspaceRepo?.name;
    if (hostName) {
      return { text: `${label}${hostName}` };
    }
    const s = ctx.git && ctx.git.available ? ctx.git : null;
    if (!s || !s.origin) return { text: "", hidden: true };
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
