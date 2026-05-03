/**
 * `git-origin-owner`, `git-origin-repo`, `git-upstream`, `git-is-fork`
 * widgets (§7.6).
 *
 *   - `git-origin-owner` / `git-origin-repo` render the parsed remote
 *     metadata; hidden when there's no `origin` remote configured.
 *     Per spec the OSC-8 link toggle is reserved for a follow-up PR.
 *   - `git-upstream` renders the upstream tracking ref
 *     (e.g., `origin/main`); hidden without one.
 *   - `git-is-fork` renders a configurable indicator when the remote
 *     graph carries an `upstream` remote whose owner differs from
 *     `origin`. With no `upstream` remote we cannot tell, so the
 *     widget stays hidden.
 */

import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";

interface OwnerOptions {
  readonly label?: string;
}

interface UpstreamOptions {
  readonly label?: string;
}

interface ForkOptions {
  readonly label?: string;
  readonly forkText?: string;
  readonly notForkText?: string;
}

export const gitOriginOwnerWidget = defineWidget<OwnerOptions>(
  "git-origin-owner",
  (ctx, settings): Cell => {
    const s = ctx.git && ctx.git.available ? ctx.git : null;
    if (!s || !s.origin) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${s.origin.owner}` };
  },
);

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

export const gitIsForkWidget = defineWidget<ForkOptions>(
  "git-is-fork",
  (ctx, settings): Cell => {
    const s = ctx.git && ctx.git.available ? ctx.git : null;
    if (!s || !s.upstreamRemote) return { text: "", hidden: true };
    const isFork = s.origin !== null && s.origin.owner !== s.upstreamRemote.owner;
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    const text = isFork
      ? (settings.options.forkText ?? "fork")
      : (settings.options.notForkText ?? "");
    if (!text) return { text: "", hidden: true };
    return { text: `${label}${text}` };
  },
);
