/**
 * `agentline reset` — restore agentline to its shipped default state.
 *
 * Delegates to scripts/install.sh, always forwarding `--reset` so the
 * user config is overwritten from the default template (the bare
 * install path deliberately preserves an existing config). Everything
 * else install does — themes, skills, statusLine wiring, manifest — is
 * idempotent / first-writer-wins and is reused unchanged, so `reset`
 * also performs first-time wiring on a host that was never set up.
 *
 * `reset` is the user/agent-facing entry point; `install` still works
 * but is hidden from `agentline help` (see src/cli.ts).
 */

import { spawnSync } from "node:child_process";
import { isHelpFlag, requestHelp } from "../cli/help.js";
import { projectGate } from "../../core/lib/claude-project.js";
import { resolveScript } from "../../core/lib/resolve-script.js";
import { maybeRefresh } from "../update-check/index.js";

const HELP = `agentline reset — restore agentline to its default state

Usage:
  agentline reset [--from-source] [--force] [--dry-run]

Resets the user config to the shipped default template (overwriting your
edits), re-seeds themes and skills, and ensures the Claude Code statusLine
is wired. If agentline is not yet set up on this host, reset performs the
first-time wiring too.

Options:
  --from-source   npm link from the local checkout instead of the registry.
  --force         Overwrite a non-agentline statusLine value.
  --dry-run       Print every action that would be taken; touch nothing.
  -h, --help      Show this message.

Your config.json IS overwritten. Themes/skills you edited and any
pre-install statusLine backup are preserved.
`;

export interface ResetArgs {
  readonly fromSource: boolean;
  readonly force: boolean;
  readonly dryRun: boolean;
}

export function parseResetArgs(rest: readonly string[]): ResetArgs {
  let fromSource = false;
  let force = false;
  let dryRun = false;
  for (const arg of rest) {
    if (arg === "--from-source") fromSource = true;
    else if (arg === "--force") force = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else throw new Error(`agentline reset: unknown argument '${arg}'`);
  }
  return { fromSource, force, dryRun };
}

export interface ResetRunOptions {
  /** Cwd the project-gate probes. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** Stdin override for the project-gate prompt; tests inject a PassThrough. */
  readonly stdin?: NodeJS.ReadableStream & { readonly isTTY?: boolean };
}

export async function runResetCommand(
  args: ResetArgs,
  opts: ResetRunOptions = {},
): Promise<number> {
  const gate = await projectGate({
    command: "reset",
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
    ...(opts.stdin !== undefined ? { stdin: opts.stdin } : {}),
  });
  if (gate === "skip") return 0;
  const script = resolveScript("install.sh", "reset");
  // `--reset` is always forwarded: it is the whole point of `reset`
  // versus the hidden `install`. The remaining flags mirror install.
  const argv: string[] = ["--reset"];
  if (args.fromSource) argv.push("--from-source");
  if (args.force) argv.push("--force");
  if (args.dryRun) argv.push("--dry-run");

  const result = spawnSync("bash", [script, ...argv], { stdio: "inherit" });
  if (result.error) throw result.error;
  /*
   * Fire-and-forget npm-registry probe so a subsequent `agentline
   * doctor` has a populated cache. Dry-run skips it — the user hasn't
   * committed to anything, and dry-run is expected to do zero outbound
   * I/O. Failure is swallowed inside `maybeRefresh`.
   */
  if (!args.dryRun && result.status === 0) {
    void maybeRefresh();
  }
  return result.status ?? 1;
}
