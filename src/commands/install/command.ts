/**
 * `agentline install` — wire @odere-pro/agentline into Claude Code's statusline.
 *
 * Delegates to scripts/install.sh. Flags are forwarded 1-to-1; stdin/
 * stdout/stderr are inherited so the interactive global-wire prompt
 * passes through to the terminal unchanged.
 */

import { spawnSync } from "node:child_process";
import { EN_DICTIONARY } from "../../core/i18n/index.js";
import { isHelpFlag, requestHelp } from "../../core/lib/help/help.js";
import { projectGate } from "../../core/lib/claude-project/claude-project.js";
import { resolveScript } from "../../core/lib/resolve-script.js";
import { printNextSteps } from "../next-steps/next-steps.js";
import { maybeRefresh } from "../update-check/index.js";

const HELP = EN_DICTIONARY["cmd.install.help"];

export interface InstallArgs {
  readonly fromSource: boolean;
  readonly force: boolean;
  readonly dryRun: boolean;
}

export function parseInstallArgs(rest: readonly string[]): InstallArgs {
  let fromSource = false;
  let force = false;
  let dryRun = false;
  for (const arg of rest) {
    if (arg === "--from-source") fromSource = true;
    else if (arg === "--force") force = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else throw new Error(`agentline install: unknown argument '${arg}'`);
  }
  return { fromSource, force, dryRun };
}

export interface InstallRunOptions {
  /** Cwd the project-gate probes. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** Stdin override for the project-gate prompt; tests inject a PassThrough. */
  readonly stdin?: NodeJS.ReadableStream & { readonly isTTY?: boolean };
}

export async function runInstallCommand(
  args: InstallArgs,
  opts: InstallRunOptions = {},
): Promise<number> {
  const gate = await projectGate({
    command: "install",
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
    ...(opts.stdin !== undefined ? { stdin: opts.stdin } : {}),
  });
  if (gate === "skip") return 0;
  const script = resolveScript("install.sh", "install");
  const argv: string[] = [];
  if (args.fromSource) argv.push("--from-source");
  if (args.force) argv.push("--force");
  if (args.dryRun) argv.push("--dry-run");

  const result = spawnSync("bash", [script, ...argv], { stdio: "inherit" });
  if (result.error) throw result.error;
  /*
   * Fire-and-forget npm-registry probe so a subsequent `agentline
   * doctor` has a populated cache. Dry-run skips it — the user hasn't
   * committed to anything, and dry-run is expected to do zero outbound
   * I/O. The trailing `.catch` contains any rejection that escapes
   * `maybeRefresh` so it can't surface as Node's `unhandledRejection`
   * after this verb has already returned.
   */
  if (!args.dryRun && result.status === 0) {
    // Show a freshly wired user their next move (issue #263). Gated on a
    // successful, non-dry-run wire so gate-09/gate-10 stay green.
    printNextSteps();
    void maybeRefresh().catch(() => undefined);
  }
  return result.status ?? 1;
}
