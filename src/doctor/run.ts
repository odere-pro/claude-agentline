/**
 * Top-level orchestrator: run every check, optionally apply fixes,
 * pick the formatter, and decide the exit code.
 *
 * Exit codes (per spec §9.3):
 *   0  — success (default)
 *   3  — only when `--strict` is passed AND any check finished as
 *        `warn` or `fail` (i.e. anything that wasn't fully resolved).
 */

import { homedir } from "node:os";
import { runChecks } from "./checks.js";
import { applyFixes } from "./fix.js";
import { formatText, formatJson, summariseWorst } from "./format.js";
import type { RunOptions, RunReport, CheckResult } from "./types.js";
import { resolveEnv } from "../lib/env.js";

export async function runDoctor(
  opts: RunOptions,
): Promise<{ report: RunReport; exitCode: number }> {
  const ctx = {
    home: opts.home ?? homedir(),
    env: resolveEnv(opts),
    cwd: opts.cwd ?? process.cwd(),
  };
  let results = await runChecks({ ...opts, home: ctx.home, env: ctx.env, cwd: ctx.cwd });
  if (opts.fix) {
    results = await applyFixes(results, {
      home: ctx.home,
      env: ctx.env,
    });
  }
  const worst = summariseWorst(results);
  const report: RunReport = { results, worst };
  const exitCode = decideExit(opts, results, worst);
  return { report, exitCode };
}

export function renderReport(report: RunReport, json: boolean): string {
  return json ? formatJson(report) : formatText(report);
}

function decideExit(opts: RunOptions, _results: CheckResult[], worst: string): number {
  if (!opts.strict) return 0;
  return worst === "pass" || worst === "skip" || worst === "fixed" ? 0 : 3;
}
