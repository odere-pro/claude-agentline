/**
 * The post-wire "next steps" nudge, shared by the TS wiring verbs.
 *
 * `install` and `reset` both end (on a successful, non-dry-run wire) by
 * pointing a freshly wired user at their next move — the restart that
 * makes the statusline appear, then `agentline edit` / `uninstall` (issue
 * #263). Authored once in `EN_DICTIONARY["cmd.install.next-steps"]` and
 * printed here so the two call sites cannot drift.
 *
 * Pure stdout, no file write: callers gate it behind `!dryRun && status
 * === 0`, so gate-09's byte-clean settings no-op and gate-10's --dry-run
 * parity are unaffected (the doctor-hint that `scripts/install.sh` prints
 * is deliberately NOT repeated here). `start` intentionally does not call
 * this — it shows a live preview instead.
 */

import { EN_DICTIONARY } from "../../core/i18n/index.js";

/**
 * Write the next-steps nudge to stdout. A leading blank line separates it
 * from `scripts/install.sh`'s own output that precedes it.
 */
export function printNextSteps(): void {
  process.stdout.write(`\n${EN_DICTIONARY["cmd.install.next-steps"]}\n`);
}
