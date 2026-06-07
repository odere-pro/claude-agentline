/**
 * Shared types for the doctor module.
 *
 * Every check returns one `CheckResult`. The orchestrator gathers
 * results and the formatters render them as text or JSON.
 */

import type { CheckCtx } from "./checks/context.js";

export type CheckStatus = "pass" | "warn" | "fail" | "fixed" | "skip";

export interface CheckResult {
  /** Stable id like "D01" — used as JSON key and display column. */
  id: string;
  /** Human title shown in the text formatter. */
  title: string;
  /** Final status after run (and optional fix attempt). */
  status: CheckStatus;
  /** One-line summary the user reads first. */
  message: string;
  /** Optional remediation hint shown when status is `warn` or `fail`. */
  hint?: string;
  /** When `true`, this check was modified in-place by `--fix`. */
  fixed?: boolean;
}

export interface RunOptions {
  fix: boolean;
  json: boolean;
  strict: boolean;
  /** Override the home directory (tests). */
  home?: string;
  /** Override env (tests). */
  env?: NodeJS.ProcessEnv;
  /** Override cwd (tests). */
  cwd?: string;
  /**
   * Test seam: substitute the claude-health refresh called by D10.
   * Pass a no-op (e.g. `async () => {}`) to suppress the actual `claude`
   * probe and read only the pre-seeded cache file.
   */
  claudeHealthRefresh?: CheckCtx["claudeHealthRefresh"];
}

export interface RunReport {
  results: CheckResult[];
  /** Highest severity encountered after fixes were applied. */
  worst: CheckStatus;
}
