/**
 * Text and JSON formatters for the doctor report.
 *
 * Text format is plain ASCII with leading status glyphs so it stays
 * readable when the host has no truecolor support and so it can be
 * grep'd by CI scripts. JSON format is the canonical machine surface.
 */

import type { CheckResult, RunReport, CheckStatus } from "./types.js";

const GLYPHS: Record<CheckStatus, string> = {
  pass: "[ok]",
  warn: "[!!]",
  fail: "[XX]",
  fixed: "[fx]",
  skip: "[--]",
};

export function summariseWorst(results: CheckResult[]): CheckStatus {
  const order: CheckStatus[] = ["fail", "warn", "fixed", "skip", "pass"];
  for (const s of order) if (results.some((r) => r.status === s)) return s;
  return "pass";
}

export function formatText(report: RunReport): string {
  const lines: string[] = [];
  for (const r of report.results) {
    lines.push(`${GLYPHS[r.status]} ${r.id} ${r.title} — ${r.message}`);
    if (r.hint) lines.push(`     ↳ ${r.hint}`);
  }
  lines.push("");
  lines.push(`summary: ${countByStatus(report.results)}`);
  return lines.join("\n") + "\n";
}

export function formatJson(report: RunReport): string {
  return (
    JSON.stringify(
      {
        worst: report.worst,
        checks: report.results.map((r) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          message: r.message,
          ...(r.hint ? { hint: r.hint } : {}),
          ...(r.fixed ? { fixed: true } : {}),
        })),
      },
      null,
      2,
    ) + "\n"
  );
}

function countByStatus(results: CheckResult[]): string {
  const counts: Record<CheckStatus, number> = {
    pass: 0,
    warn: 0,
    fail: 0,
    fixed: 0,
    skip: 0,
  };
  for (const r of results) counts[r.status]++;
  const parts: string[] = [];
  for (const k of ["pass", "fixed", "warn", "fail", "skip"] as CheckStatus[]) {
    if (counts[k] > 0) parts.push(`${counts[k]} ${k}`);
  }
  return parts.join(", ");
}
