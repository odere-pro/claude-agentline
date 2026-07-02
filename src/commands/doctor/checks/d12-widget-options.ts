/**
 * D12 — Widget option sanity (advisory).
 *
 * Surfaces widget `options` keys the render path silently ignores. The
 * config schema keeps each widget's `options` bag open
 * (`additionalProperties: true`) for forward-compat, so a typo like
 * `thinking-effort: { variant: … }` validates fine yet does nothing at
 * render time — exactly the footgun that made issue #295 hard to diagnose
 * (`variant` is valid on `git-pr`, so reaching for it elsewhere is a natural
 * mistake). This check names the offending widget + option so the user can
 * fix it.
 *
 * Source of truth: `validateWidgetOption` (the same audited per-widget spec
 * the authoring/mutation commands enforce), so the two never drift.
 *
 * Severity: `warn` — the statusline still renders; the flagged options are
 * simply inert. Returns `pass` when config is not loaded (D03 owns that) or
 * when every configured option is recognised.
 */

import { validateWidgetOption } from "../../../widgets/families/option-spec/option-spec.js";
import type { CheckResult } from "../types.js";

import { type CheckCtx, ok } from "./context.js";

export async function checkD12(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d12.title");

  if (!ctx.config) {
    return ok("D12", title, ctx.t("cmd.doctor.d12.no-config"));
  }

  // Surface the audited spec's own message for every rejected option — it
  // already names the widget, the bad key/value, AND the valid set (e.g.
  // `… (known: 'assumeUltracode', 'emphasis', 'label')`), which is exactly
  // what resolves the #295 footgun. Strip the spec's trailing
  // catalogue-pointer (the hint carries remediation once) and dedupe.
  const problems: string[] = [];
  for (const line of ctx.config.lines) {
    for (const w of line.widgets) {
      for (const [key, value] of Object.entries(w.options ?? {})) {
        const msg = validateWidgetOption(w.type, key, value);
        if (msg === null) continue;
        const detail = msg.replace(/ — run `agentline config widget catalog`$/, "");
        if (!problems.includes(detail)) problems.push(detail);
      }
    }
  }

  if (problems.length === 0) {
    return ok("D12", title, ctx.t("cmd.doctor.d12.ok"));
  }

  const s = problems.length === 1 ? "" : "s";
  return {
    id: "D12",
    title,
    status: "warn",
    message: ctx.t("cmd.doctor.d12.unknown", { details: problems.join("; "), s }),
    hint: ctx.t("cmd.doctor.d12.hint"),
  };
}
