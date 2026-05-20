/**
 * Text and JSON formatters for the doctor report.
 *
 * Text format aligns checks into a status table: glyph + id + title +
 * message, with hints indented under the row that produced them. The
 * glyphs colourise (when stdout is a TTY and NO_COLOR is unset) but
 * remain greppable. JSON format is the canonical machine surface.
 */

import type { CheckResult, RunReport, CheckStatus } from "../types.js";
import { resolveEnv } from "../../../core/lib/env/env.js";

const GLYPHS: Record<CheckStatus, string> = {
  pass: "[ok]",
  warn: "[!!]",
  fail: "[XX]",
  fixed: "[fx]",
  skip: "[--]",
};

const GLYPH_COLOUR: Record<CheckStatus, string> = {
  pass: "\x1b[32m",
  warn: "\x1b[33m",
  fail: "\x1b[31m",
  fixed: "\x1b[36m",
  skip: "\x1b[90m",
};

const SGR_RESET = "\x1b[0m";

export interface FormatTextOptions {
  readonly tty?: boolean;
  readonly env?: NodeJS.ProcessEnv;
}

export function summariseWorst(results: CheckResult[]): CheckStatus {
  const order: CheckStatus[] = ["fail", "warn", "fixed", "skip", "pass"];
  for (const s of order) if (results.some((r) => r.status === s)) return s;
  return "pass";
}

export function formatText(report: RunReport, options: FormatTextOptions = {}): string {
  const env = resolveEnv(options);
  const useColour = colourEnabled(options.tty, env);
  const widestTitle = report.results.reduce((n, r) => Math.max(n, r.title.length), 0);
  const lines: string[] = [];
  for (const r of report.results) {
    const glyph = useColour
      ? `${GLYPH_COLOUR[r.status]}${GLYPHS[r.status]}${SGR_RESET}`
      : GLYPHS[r.status];
    const title = r.title.padEnd(widestTitle, " ");
    lines.push(`${glyph} ${r.id}  ${title}  ${r.message}`);
    if (r.hint) lines.push(`         ↳ ${r.hint}`);
  }
  lines.push("");
  lines.push(`summary: ${countByStatus(report.results)}`);
  const next = nextStepHint(report.results);
  if (next) lines.push(next);
  return lines.join("\n") + "\n";
}

function colourEnabled(tty: boolean | undefined, env: NodeJS.ProcessEnv): boolean {
  if (env.NO_COLOR) return false;
  if (tty !== undefined) return tty;
  return Boolean(process.stdout.isTTY);
}

function nextStepHint(results: CheckResult[]): string | undefined {
  const fixable = results.filter(
    (r) => (r.status === "fail" || r.status === "warn") && r.hint?.includes("--fix"),
  );
  if (fixable.length > 0) {
    return `next: agentline doctor --fix    # repair ${fixable.length} auto-fixable check${fixable.length === 1 ? "" : "s"}`;
  }
  const failed = results.filter((r) => r.status === "fail" || r.status === "warn");
  if (failed.length > 0) {
    return `next: agentline doctor --json   # machine-readable detail`;
  }
  return undefined;
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
