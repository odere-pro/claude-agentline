/**
 * D08 — Render dry-run on embedded fixture matches snapshot.
 */

import { runEmbeddedRenderFixture } from "../fixture.js";
import type { CheckResult } from "../types.js";

import type { CheckCtx } from "./context.js";

export async function checkD08(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d08.title");
  const result = await runEmbeddedRenderFixture();
  if (result.match) {
    return {
      id: "D08",
      title,
      status: "pass",
      message: ctx.t("cmd.doctor.d08.ok"),
    };
  }
  return {
    id: "D08",
    title,
    status: "fail",
    message: result.detail,
    hint: ctx.t("cmd.doctor.d08.hint-drift"),
  };
}
