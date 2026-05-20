/**
 * D01 — Claude Code settings file (under the user's home `.claude` dir) exists.
 */

import { pathExists } from "../../../core/lib/fs/fs.js";
import type { CheckResult } from "../types.js";

import { type CheckCtx, ok, settingsPath } from "./context.js";

export async function checkD01(ctx: CheckCtx): Promise<CheckResult> {
  const settings = settingsPath(ctx.home);
  if (await pathExists(settings)) {
    return ok(
      "D01",
      ctx.t("cmd.doctor.d01.title"),
      ctx.t("cmd.doctor.d01.found", { path: settings }),
    );
  }
  return {
    id: "D01",
    title: ctx.t("cmd.doctor.d01.title"),
    status: "warn",
    message: ctx.t("cmd.doctor.d01.missing", { path: settings }),
    hint: ctx.t("cmd.doctor.d01.hint-scaffold"),
  };
}
