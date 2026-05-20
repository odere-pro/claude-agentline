/**
 * D05 — `git` on PATH (when any git widget enabled).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CheckResult } from "../types.js";

import { type CheckCtx, EXEC_TIMEOUTS, hasGitWidget, ok } from "./context.js";

const execFileP = promisify(execFile);

export async function checkD05(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d05.title");
  if (!hasGitWidget(ctx.config)) {
    return ok("D05", title, ctx.t("cmd.doctor.d05.skipped"));
  }
  try {
    await execFileP("git", ["--version"], { timeout: EXEC_TIMEOUTS.gitVersion });
    return ok("D05", title, ctx.t("cmd.doctor.d05.ok"));
  } catch {
    return {
      id: "D05",
      title,
      status: "warn",
      message: ctx.t("cmd.doctor.d05.failed"),
      hint: ctx.t("cmd.doctor.d05.hint"),
    };
  }
}
