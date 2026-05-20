/**
 * D09 — `statusLine.refreshInterval` matches the configured cadence.
 *
 * The agentline config owns `refreshInterval`; install / `config
 * refresh` / this fixer mirror it into Claude Code's settings.json.
 * `0` means "event-driven only" (the field must be absent); `>= 1`
 * must equal the field. Not applicable (→ pass with note) when the
 * config failed to load (D03 owns that) or the statusLine is not wired
 * to agentline (D02 owns that) — D09 never double-reports another
 * check's failure.
 */

import { isPlainObject } from "../../../core/lib/object/object.js";
import type { CheckResult } from "../types.js";

import {
  type CheckCtx,
  extractStatusLineCommand,
  ok,
  readJsonOrNull,
  settingsPath,
} from "./context.js";

export async function checkD09(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d09.title");
  if (!ctx.config) {
    return ok("D09", title, ctx.t("cmd.doctor.d09.no-config"));
  }
  const expected = ctx.config.refreshInterval;
  const parsed = await readJsonOrNull(settingsPath(ctx.home));
  if (!isPlainObject(parsed)) {
    return ok("D09", title, ctx.t("cmd.doctor.d09.no-settings"));
  }
  const sl = parsed["statusLine"];
  const cmd = extractStatusLineCommand(sl);
  if (!cmd || !/agentline/.test(cmd) || !isPlainObject(sl)) {
    return ok("D09", title, ctx.t("cmd.doctor.d09.not-wired"));
  }
  const actual = sl["refreshInterval"];

  if (expected === 0) {
    if (actual === undefined) {
      return ok("D09", title, ctx.t("cmd.doctor.d09.disabled-ok"));
    }
    return {
      id: "D09",
      title,
      status: "warn",
      message: ctx.t("cmd.doctor.d09.disabled-mismatch", { actual: JSON.stringify(actual) }),
      hint: ctx.t("cmd.doctor.d09.hint-disabled-mismatch"),
    };
  }
  if (actual === expected) {
    return ok("D09", title, ctx.t("cmd.doctor.d09.synced", { expected }));
  }
  return {
    id: "D09",
    title,
    status: "warn",
    message:
      actual === undefined
        ? ctx.t("cmd.doctor.d09.mismatch-none", { expected })
        : ctx.t("cmd.doctor.d09.mismatch", { expected, actual: JSON.stringify(actual) }),
    hint: ctx.t("cmd.doctor.d09.hint-mismatch"),
  };
}
