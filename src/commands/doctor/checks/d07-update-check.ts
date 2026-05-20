/**
 * D07 — Update-check cache (read-only). Surfaces a hint when the cache
 * says a newer `@odere-pro/agentline` exists. Never initiates a fetch from
 * inside `runChecks`; the cache is refreshed by `install`, `edit`,
 * and any future explicit refresh entry point. A missing cache or
 * registry-unreachable state is reported as `pass` with an
 * explanation — none of that is "broken host wiring".
 */

import { readVersionCheckSync } from "../../../data/state/version-check-cache/version-check-cache.js";
import { AGENTLINE_VERSION } from "../../../version.js";
import { isNewer } from "../../update-check/refresh/refresh.js";
import type { CheckResult } from "../types.js";

import type { CheckCtx } from "./context.js";

export async function checkD07(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d07.title");
  const cache = readVersionCheckSync(ctx.env);
  if (cache === null) {
    return {
      id: "D07",
      title,
      status: "pass",
      message: ctx.t("cmd.doctor.d07.no-cache", { current: AGENTLINE_VERSION }),
      hint: ctx.t("cmd.doctor.d07.hint-no-cache"),
    };
  }
  if (cache.latest === null) {
    return {
      id: "D07",
      title,
      status: "pass",
      message: ctx.t("cmd.doctor.d07.last-failed", { current: AGENTLINE_VERSION }),
    };
  }
  if (isNewer(cache.latest, AGENTLINE_VERSION)) {
    return {
      id: "D07",
      title,
      status: "pass",
      message: ctx.t("cmd.doctor.d07.available", {
        current: AGENTLINE_VERSION,
        latest: cache.latest,
      }),
      hint: ctx.t("cmd.doctor.d07.hint-available"),
    };
  }
  return {
    id: "D07",
    title,
    status: "pass",
    message: ctx.t("cmd.doctor.d07.up-to-date", { current: AGENTLINE_VERSION }),
  };
}
