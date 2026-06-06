/**
 * D11 — Widget config sanity (advisory).
 *
 * Surfaces two classes of "configured but will not render" widgets so
 * the user can take action after an upgrade or a hand-edit:
 *
 *  1. **Unknown / removed widget types.** Any `type` in the configured
 *     widget list that is absent from the widget catalogue renders as a
 *     hidden cell with no feedback in the statusline. PR #206 removed
 *     eight types (claude-doctor, claude-update, context-bar,
 *     context-length, git-sha, git-untracked, current-session-reset-at,
 *     weekly-reset-at); a user who upgrades without editing their config
 *     will silently lose those slots.
 *
 *  2. **`git-pr` without the network opt-in.** A `git-pr` widget whose
 *     `options.allowNetwork` is not explicitly `true` will never display
 *     a PR — the resolver skips the network call. The widget is
 *     technically registered, but it is effectively inert without the
 *     opt-in.
 *
 * Severity: `warn` (not `fail`) — the statusline still renders; these
 * are advisories. Returns `pass` when config is not loaded (D03 owns
 * that) or when every configured widget is renderable.
 *
 * Source of truth for valid types: `WIDGET_CATALOG` (the static
 * catalogue). Never a hardcoded list, so it stays accurate as the widget
 * set evolves.
 */

import { WIDGET_CATALOG } from "../../../widgets/families/catalog.js";
import type { CheckResult } from "../types.js";

import { type CheckCtx, ok } from "./context.js";

export async function checkD11(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d11.title");

  if (!ctx.config) {
    return ok("D11", title, ctx.t("cmd.doctor.d11.no-config"));
  }

  const allWidgets = ctx.config.lines.flatMap((line) => line.widgets);

  // (1) Collect types not present in the catalogue (deduplicated, insertion order).
  const unknownTypes: string[] = [];
  for (const w of allWidgets) {
    if (!(w.type in WIDGET_CATALOG) && !unknownTypes.includes(w.type)) {
      unknownTypes.push(w.type);
    }
  }

  // (2) Any git-pr widget without allowNetwork: true will never show a PR.
  const gitPrWithoutNetwork = allWidgets.some(
    (w) => w.type === "git-pr" && w.options?.["allowNetwork"] !== true,
  );

  const n = allWidgets.length;

  if (unknownTypes.length === 0 && !gitPrWithoutNetwork) {
    return ok("D11", title, ctx.t("cmd.doctor.d11.ok", { n, s: n === 1 ? "" : "s" }));
  }

  // Build a combined warn result covering whichever issues fired.
  if (unknownTypes.length > 0 && gitPrWithoutNetwork) {
    const types = unknownTypes.join(", ");
    const s = unknownTypes.length === 1 ? "" : "s";
    return {
      id: "D11",
      title,
      status: "warn",
      message: ctx.t("cmd.doctor.d11.mixed", { types, s }),
      hint: ctx.t("cmd.doctor.d11.hint-mixed"),
    };
  }

  if (unknownTypes.length > 0) {
    const types = unknownTypes.join(", ");
    const s = unknownTypes.length === 1 ? "" : "s";
    return {
      id: "D11",
      title,
      status: "warn",
      message: ctx.t("cmd.doctor.d11.unknown-types", { types, s }),
      hint: ctx.t("cmd.doctor.d11.hint-unknown"),
    };
  }

  // Only git-pr without network opt-in.
  return {
    id: "D11",
    title,
    status: "warn",
    message: ctx.t("cmd.doctor.d11.git-pr-no-network"),
    hint: ctx.t("cmd.doctor.d11.hint-git-pr"),
  };
}
