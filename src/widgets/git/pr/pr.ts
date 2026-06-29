/**
 * `git-pr` widget (§7.6 add-on). Renders the pull-request that the
 * current branch belongs to.
 *
 * Network gating
 * --------------
 * The render contract (§1.2 N5) forbids outbound calls during render.
 * The actual `gh pr view` invocation lives in `src/git/pr.ts` and only
 * fires when `loadGitSnapshot` is called with `allowPullRequest: true`.
 *
 * Provenance decides the gate (`snap.prSource`):
 *   - `"host"`    → the host populated `pr.{number,url}` on stdin; the
 *                   data is free (no subprocess, no latency, no privacy
 *                   cost), so the widget renders by default.
 *   - `"network"` → fetched via `gh pr view`; the widget stays hidden
 *                   unless the user sets `options.allowNetwork: true`,
 *                   giving the in-band signal to whatever wires up the
 *                   snapshot loader — and a defense-in-depth check so a
 *                   second `git-pr` without the opt-in never shows it.
 *
 * Variants (catalogue):
 *   - `number` (default) → `#42`
 *   - `url`              → `https://github.com/owner/repo/pull/42`
 *   - `title`            → `feat: do the thing`
 *   - `number-title`     → `#42 feat: do the thing`
 *
 * Hides on every "no data" path: opted out, snapshot unavailable, no
 * PR for the branch, `gh` not installed.
 */

import type { Cell } from "../../cell/cell.js";
import { valueSeparator } from "../../separator/separator.js";
import { defineWidget } from "../../widget.js";

type GitPrVariant = "number" | "url" | "title" | "number-title";

interface Options {
  readonly label?: string;
  /**
   * Opt-in for the **network** PR source only. A host-provided PR
   * (`prSource === "host"`) renders without it. When the PR would come
   * from `gh pr view` (`prSource === "network"`), the widget hides unless
   * this is `true` — signalling to the data layer (and the in-session
   * reviewer) that the user has accepted the latency / privacy cost of
   * running `gh pr view` on every render tick.
   */
  readonly allowNetwork?: boolean;
  readonly variant?: GitPrVariant;
}

const VALID_VARIANTS: ReadonlySet<GitPrVariant> = new Set<GitPrVariant>([
  "number",
  "url",
  "title",
  "number-title",
]);

function renderVariant(
  variant: GitPrVariant,
  pr: { readonly number: number; readonly url: string; readonly title: string },
  sep: string,
): string {
  switch (variant) {
    case "number":
      return `#${pr.number}`;
    case "url":
      return pr.url;
    case "title":
      return pr.title;
    case "number-title":
      return pr.title.length > 0 ? `#${pr.number} ${sep} ${pr.title}` : `#${pr.number}`;
  }
}

export const gitPrWidget = defineWidget<Options>("git-pr", (ctx, settings): Cell => {
  const snap = ctx.git;
  if (!snap || !snap.available || !snap.pr) return { text: "", hidden: true };
  // Loader invariant: a non-null `pr` always carries a provenance. Guard it
  // explicitly so a malformed snapshot (pr present, prSource null) hides
  // rather than rendering ungated — and so the union narrows to
  // "host" | "network" for the network-opt-in check below.
  if (snap.prSource === null) return { text: "", hidden: true };
  // A network-sourced PR (the `gh` shell-out) still requires the explicit
  // opt-in; a host-provided PR is free and renders by default.
  if (snap.prSource === "network" && settings.options.allowNetwork !== true) {
    return { text: "", hidden: true };
  }
  const requested = settings.options.variant ?? "number";
  const variant: GitPrVariant = VALID_VARIANTS.has(requested) ? requested : "number";
  const body = renderVariant(variant, snap.pr, valueSeparator(ctx));
  if (!body) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  // The PR url is the natural click target for every variant — clicking
  // the rendered `#42` / title opens the pull request in the browser.
  const href = snap.pr.url;
  return { text: `${label}${body}`, ...(href ? { href } : {}) };
});
