/**
 * D03 — User config exists and matches schema.
 */

import type { CheckResult } from "../types.js";

import { type CheckCtx, ok } from "./context.js";

export async function checkD03(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d03.title");
  if (ctx.configError) {
    return {
      id: "D03",
      title,
      status: "fail",
      message: ctx.configError.message.split("\n")[0] ?? "config invalid",
      hint: ctx.t("cmd.doctor.d03.hint"),
    };
  }
  return ok("D03", title, ctx.t("cmd.doctor.d03.ok"));
}
