/**
 * Pure parsers for the Claude-CLI health probes. No I/O — fed raw command
 * output by the refresher, unit-tested in isolation. The `claude doctor`
 * heuristic is intentionally forgiving: its output format is not a stable
 * contract, so we count marker lines best-effort and fall back to
 * `unknown` when nothing recognisable comes back.
 */

import type { ClaudeDoctorSummary } from "../../../data/state/claude-health-cache/claude-health-cache.js";

const SEMVER_RE = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/;

/** Best-effort extraction of a semver from `claude --version` output. */
export function parseClaudeVersion(text: string | null): string | null {
  if (!text) return null;
  const match = SEMVER_RE.exec(text);
  return match ? match[1]! : null;
}

/*
 * Strip ANSI CSI escape sequences (colour codes) so marker detection works
 * on piped TUI output. Conservative — leaves visible text and our markers
 * intact.
 */
const ANSI_CSI_RE = /\[[0-9;]*[A-Za-z]/g;

const ISSUE_MARKERS = ["error", "failed", "missing", "not found"];
const ISSUE_GLYPHS = ["✗", "✘", "✖", "❌"];
const WARNING_MARKERS = ["warning", "outdated", "deprecated"];
const WARNING_GLYPHS = ["⚠"];

function countMatchingLines(lines: readonly string[], needles: readonly string[]): number {
  return lines.filter((line) => needles.some((n) => line.includes(n))).length;
}

/**
 * Interpret `claude doctor` output into a coarse summary. Returns `null`
 * when there is nothing to parse (empty / whitespace), so the caller can
 * record `doctor: null`.
 */
export function parseClaudeDoctor(text: string | null): ClaudeDoctorSummary | null {
  if (!text) return null;
  const cleaned = text.replace(ANSI_CSI_RE, "");
  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return null;

  const lower = lines.map((l) => l.toLowerCase());
  const issueNeedles = [...ISSUE_MARKERS, ...ISSUE_GLYPHS.map((g) => g.toLowerCase())];
  const warnNeedles = [...WARNING_MARKERS, ...WARNING_GLYPHS.map((g) => g.toLowerCase())];

  const issues = countMatchingLines(lower, issueNeedles);
  const warnings = countMatchingLines(lower, warnNeedles);

  const status = issues > 0 ? "fail" : warnings > 0 ? "warn" : "ok";
  return { status, issues, warnings };
}
