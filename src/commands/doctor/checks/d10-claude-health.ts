/**
 * D10 — Claude CLI health. Reports whether the host `claude` CLI is out of
 * date and whether `claude doctor` surfaced issues/warnings, from the
 * claude-health cache. `doctor` refreshes the cache itself when it runs.
 *
 * The refresh is performed via a lazy `await import(…)` (same pattern as
 * `src/cli/cli.ts`) so the probe/subprocess code stays out of doctor's eager
 * import graph (gate-19 / cold-start safe). Any failure — probe error, no
 * `claude` on PATH — is swallowed; the existing "unpopulated cache → pass with
 * explanation" fallback branches handle the absence.
 *
 * Severity: a `claude doctor` failure is a real host problem (`fail`); a
 * warning is `warn`; an available CLI update or a clean bill of health is
 * `pass` (an upgrade hint, like D07, is informational).
 */

import { readClaudeHealthSync } from "../../../data/state/claude-health-cache/claude-health-cache.js";
import type { MaybeRefreshClaudeHealthOptions } from "../../claude-health/index.js";
import type { CheckResult } from "../types.js";

import type { CheckCtx } from "./context.js";

export async function checkD10(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d10.title");

  /*
   * Self-refresh: run the existing refresher before reading the cache.
   * Best-effort — any failure (probe error, no `claude` on PATH, network
   * unavailable) is swallowed so the fallback branches below remain the
   * canonical "unpopulated cache" path.
   *
   * The lazy `import(…)` form keeps the network/subprocess code out of
   * doctor's eager import graph (gate-19/cold-start safe). The
   * `ctx.claudeHealthRefresh` seam lets tests substitute a no-op so the
   * pre-seeded cache file is read verbatim without triggering an actual
   * `claude` probe.
   */
  try {
    const refresh =
      ctx.claudeHealthRefresh ??
      (async (opts?: MaybeRefreshClaudeHealthOptions) => {
        const { maybeRefreshClaudeHealth } = await import("../../claude-health/index.js");
        return maybeRefreshClaudeHealth(opts);
      });
    await refresh({ env: ctx.env });
  } catch {
    /* Best-effort — probe failure must never affect the check result. */
  }

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
