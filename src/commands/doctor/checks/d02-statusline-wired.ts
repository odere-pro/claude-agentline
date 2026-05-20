/**
 * D02 — `statusLine.command` resolves to a working `agentline` invocation.
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

export async function checkD02(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d02.title");
  const settings = settingsPath(ctx.home);
  const parsed = await readJsonOrNull(settings);
  if (!isPlainObject(parsed)) {
    return {
      id: "D02",
      title,
      status: "warn",
      message:
        parsed === null
          ? ctx.t("cmd.doctor.d02.settings-missing")
          : ctx.t("cmd.doctor.d02.settings-not-object"),
      hint: ctx.t("cmd.doctor.d02.hint-fix-d01"),
    };
  }
  const sl = parsed["statusLine"];
  if (sl === undefined || sl === null) {
    return {
      id: "D02",
      title,
      status: "warn",
      message: ctx.t("cmd.doctor.d02.no-statusline"),
      hint: ctx.t("cmd.doctor.d02.hint-wire"),
    };
  }
  const cmd = extractStatusLineCommand(sl);
  if (!cmd) {
    return {
      id: "D02",
      title,
      status: "warn",
      message: ctx.t("cmd.doctor.d02.no-command"),
      hint: ctx.t("cmd.doctor.d02.hint-overwrite"),
    };
  }
  if (!/agentline/.test(cmd)) {
    return {
      id: "D02",
      title,
      status: "warn",
      message: ctx.t("cmd.doctor.d02.other-tool", { cmd }),
      hint: ctx.t("cmd.doctor.d02.hint-other-tool"),
    };
  }
  return ok("D02", title, ctx.t("cmd.doctor.d02.ok", { cmd }));
}
