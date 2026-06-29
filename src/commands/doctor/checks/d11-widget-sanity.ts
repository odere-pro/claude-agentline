/**
 * D11 — Widget config sanity (advisory).
 *
 * Surfaces **unknown / removed widget types** so the user can take action
 * after an upgrade or a hand-edit: any `type` in the configured widget
 * list that is absent from the widget catalogue renders as a hidden cell
 * with no feedback in the statusline. PR #206 removed eight types
 * (claude-doctor, claude-update, context-bar, context-length, git-sha,
 * git-untracked, current-session-reset-at, weekly-reset-at); a user who
 * upgrades without editing their config silently loses those slots.
 *
 * Note: `git-pr` without `options.allowNetwork` is NOT flagged. Since the
 * host bridge (issue #244) renders host-provided PRs by default, that is a
 * working configuration — `allowNetwork` only enables the additional `gh`
 * fallback. Flagging it would warn about a widget that renders fine.
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

  // Collect types not present in the catalogue (deduplicated, insertion order).
  const unknownTypes: string[] = [];
  for (const w of allWidgets) {
    if (!(w.type in WIDGET_CATALOG) && !unknownTypes.includes(w.type)) {
      unknownTypes.push(w.type);
    }
  }

  const n = allWidgets.length;

  if (unknownTypes.length === 0) {
    return ok("D11", title, ctx.t("cmd.doctor.d11.ok", { n, s: n === 1 ? "" : "s" }));
  }

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
