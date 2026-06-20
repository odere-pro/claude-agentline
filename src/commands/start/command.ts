/**
 * `agentline start` — use the installed version with your existing config.
 *
 * The visible, config-preserving counterpart to the hidden `install`
 * verb (and the config-overwriting `reset`). After publishing and
 * reinstalling a new package version, `start` re-wires the statusLine
 * (the setting Claude Code reads) to the installed binary — without ever
 * forwarding `--reset`, so the user's `config.json` is left untouched — then prints
 * a one-shot preview rendered through that existing config so they can
 * confirm the new version works.
 *
 * Wiring delegates to scripts/install.sh, reusing the same idempotent,
 * reversible, backed-up path as `install`/`reset`. Everything install
 * does is first-writer-wins / idempotent, so re-running it after a
 * package upgrade is safe.
 */

import { spawnSync } from "node:child_process";
import { EN_DICTIONARY } from "../../core/i18n/index.js";
import { isHelpFlag, requestHelp } from "../../core/lib/help/help.js";
import { projectGate } from "../../core/lib/claude-project/claude-project.js";
import { resolveScript } from "../../core/lib/resolve-script.js";
import { maybeRefresh } from "../update-check/index.js";
import { renderStartPreview } from "./preview.js";

const HELP = EN_DICTIONARY["cmd.start.help"];

export interface StartArgs {
  readonly fromSource: boolean;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly noPreview: boolean;
}

export function parseStartArgs(rest: readonly string[]): StartArgs {
  let fromSource = false;
  let force = false;
  let dryRun = false;
  let noPreview = false;
  for (const arg of rest) {
    if (arg === "--from-source") fromSource = true;
    else if (arg === "--force") force = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--no-preview") noPreview = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else throw new Error(`agentline start: unknown argument '${arg}'`);
  }
  return { fromSource, force, dryRun, noPreview };
}

export interface StartRunOptions {
  /** Cwd the project-gate probes. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** Stdin override for the project-gate prompt; tests inject a PassThrough. */
  readonly stdin?: NodeJS.ReadableStream & { readonly isTTY?: boolean };
  /** Preview renderer; injected in tests. Defaults to `renderStartPreview`. */
  readonly renderPreview?: typeof renderStartPreview;
}

export async function runStartCommand(
  args: StartArgs,
  opts: StartRunOptions = {},
): Promise<number> {
  const gate = await projectGate({
    command: "start",
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
    ...(opts.stdin !== undefined ? { stdin: opts.stdin } : {}),
  });
  if (gate === "skip") return 0;
  const script = resolveScript("install.sh", "start");
  /*
   * `--reset` is deliberately NOT forwarded: that is the whole point of
   * `start` versus `reset`. The user config is preserved; only the
   * statusLine wiring (and idempotent theme/skill/manifest seeding) runs.
   */
  const argv: string[] = [];
  if (args.fromSource) argv.push("--from-source");
  if (args.force) argv.push("--force");
  if (args.dryRun) argv.push("--dry-run");

  const result = spawnSync("bash", [script, ...argv], { stdio: "inherit" });
  if (result.error) throw result.error;
  const status = result.status ?? 1;
  if (args.dryRun || status !== 0) return status;

  /*
   * Fire-and-forget npm-registry probe so a subsequent `agentline doctor`
   * has a populated cache. The trailing `.catch` contains any rejection so
   * it cannot surface as Node's `unhandledRejection` after this verb has
   * already returned. Mirrors install/reset.
   */
  void maybeRefresh().catch(() => undefined);

  if (!args.noPreview) {
    await emitPreview(opts.renderPreview ?? renderStartPreview);
  }
  return status;
}

/**
 * Render and print the confirmation preview. A missing preview (config
 * unloadable or render failure) prints a short notice instead — the
 * wiring already succeeded, so this never changes the exit code.
 */
async function emitPreview(renderPreview: typeof renderStartPreview): Promise<void> {
  const preview = await renderPreview();
  if (preview === undefined) {
    process.stdout.write(`${EN_DICTIONARY["cmd.start.preview-unavailable"]}\n`);
    return;
  }
  process.stdout.write(`\n${EN_DICTIONARY["cmd.start.preview-label"]}\n${preview}`);
}
