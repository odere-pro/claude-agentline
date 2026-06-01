/**
 * D10 — Claude CLI health (read-only). Reports whether the host `claude`
 * CLI is out of date and whether `claude doctor` surfaced issues/warnings,
 * from the off-path claude-health cache.
 *
 * Like D07, this check never spawns `claude` or hits the network from
 * inside `runChecks` — the cache is refreshed off the render path (the live
 * render spawns a detached `__refresh-claude-health` when the cache is
 * stale). A missing / unpopulated cache is reported as `pass` with an
 * explanation: that is not "broken host wiring".
 *
 * Severity: a `claude doctor` failure is a real host problem (`fail`); a
 * warning is `warn`; an available CLI update or a clean bill of health is
 * `pass` (an upgrade hint, like D07, is informational).
 */

import { readClaudeHealthSync } from "../../../data/state/claude-health-cache/claude-health-cache.js";
import type { CheckResult } from "../types.js";

import type { CheckCtx } from "./context.js";

export async function checkD10(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d10.title");
  const cache = readClaudeHealthSync(ctx.env);

  if (cache === null) {
    return {
      id: "D10",
      title,
      status: "pass",
      message: ctx.t("cmd.doctor.d10.not-detected"),
      hint: ctx.t("cmd.doctor.d10.hint-not-detected"),
    };
  }

  if (cache.cliVersion === null) {
    return {
      id: "D10",
      title,
      status: "pass",
      message: ctx.t("cmd.doctor.d10.cli-missing"),
      hint: ctx.t("cmd.doctor.d10.hint-cli-missing"),
    };
  }

  const doctor = cache.doctor;
  if (doctor && doctor.issues > 0) {
    return {
      id: "D10",
      title,
      status: "fail",
      message: ctx.t("cmd.doctor.d10.doctor-fail", {
        issues: doctor.issues,
        warnings: doctor.warnings,
      }),
      hint: ctx.t("cmd.doctor.d10.hint-doctor"),
    };
  }
  if (doctor && doctor.warnings > 0) {
    return {
      id: "D10",
      title,
      status: "warn",
      message: ctx.t("cmd.doctor.d10.doctor-warn", { warnings: doctor.warnings }),
      hint: ctx.t("cmd.doctor.d10.hint-doctor"),
    };
  }

  if (cache.needsUpdate && cache.latestVersion !== null) {
    return {
      id: "D10",
      title,
      status: "pass",
      message: ctx.t("cmd.doctor.d10.update-available", {
        current: cache.cliVersion,
        latest: cache.latestVersion,
      }),
      hint: ctx.t("cmd.doctor.d10.hint-update"),
    };
  }

  return {
    id: "D10",
    title,
    status: "pass",
    message: ctx.t("cmd.doctor.d10.up-to-date", { current: cache.cliVersion }),
  };
}
