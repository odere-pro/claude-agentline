/**
 * D03 — User config exists and matches schema.
 */

import type { CheckResult } from "../types.js";

import { type CheckCtx, ok } from "./context.js";

export async function checkD03(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d03.title");
  if (ctx.configError) {
    // Collapse newlines to " | " so the full error (including field-path
    // detail on line 2+) reaches the user without truncation. Absolute
    // paths are stripped to satisfy gate-02: replace any path up to and
    // including "agentline/" with just "agentline/".
    const fullMessage = ctx.configError.message
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" | ")
      .replace(/[^\s"']*agentline\//g, "agentline/");
    return {
      id: "D03",
      title,
      status: "fail",
      message: fullMessage || "config invalid",
      hint: ctx.t("cmd.doctor.d03.hint"),
    };
  }
  return ok("D03", title, ctx.t("cmd.doctor.d03.ok"));
}
