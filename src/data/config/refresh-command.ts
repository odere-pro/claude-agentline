/**
 * `agentline config refresh [<seconds>]`.
 *
 * No argument prints the current effective interval (the merged config,
 * i.e. exactly what install / a future render would use). A `<seconds>`
 * argument (integer ≥ 0) persists it to the user config via the same
 * `loadConfig → mutate → validate → atomic write` path the widget
 * subcommands use, then mirrors it into Claude Code's settings.json
 * (`statusLine.refreshInterval`). `0` disables the wall-clock timer.
 *
 * When agentline's statusLine is not wired yet the config is still
 * updated, but the user is told to run `agentline install` rather than
 * us writing a partial statusLine — see `syncRefreshInterval`.
 */

import { homedir } from "node:os";

import { isHelpFlag, requestHelp } from "../../commands/cli/help.js";
import { resolveEnv } from "../../core/lib/env.js";
import { syncRefreshInterval } from "../../commands/install/settings-refresh.js";
import { loadConfig } from "./load.js";
import { saveSetRefreshInterval } from "./mutate.js";
import { resolveConfigPaths } from "./paths.js";

const PREFIX = "agentline config refresh";

const HELP = `agentline config refresh — get or set the statusline refresh cadence

Usage:
  agentline config refresh             print the current interval (seconds)
  agentline config refresh <seconds>   set it (integer >= 0; 0 disables)

The value is persisted to the agentline config and mirrored into Claude
Code's settings.json (statusLine.refreshInterval), which re-runs the
statusline every <seconds> seconds in addition to event-driven updates.
0 omits the field so Claude Code refreshes on events only.

Options:
  -h, --help   show this message
`;

export interface RefreshArgs {
  /** `undefined` → print the current value; a number → set it. */
  readonly seconds?: number;
}

export interface RefreshInput {
  readonly args: RefreshArgs;
  readonly env?: NodeJS.ProcessEnv;
  /** Overridable home for tests; defaults to `os.homedir()`. */
  readonly home?: string;
}

export function parseRefreshArgs(rest: readonly string[]): RefreshArgs {
  const positionals: string[] = [];
  for (const arg of rest) {
    if (arg === undefined) continue;
    if (isHelpFlag(arg)) requestHelp(HELP);
    else if (arg.startsWith("-")) throw new Error(`${PREFIX}: unknown option '${arg}'`);
    else positionals.push(arg);
  }
  if (positionals.length === 0) return {};
  if (positionals.length > 1) {
    throw new Error(`${PREFIX}: expected at most one <seconds> argument`);
  }
  const raw = positionals[0]!;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${PREFIX}: <seconds> must be a non-negative integer (got '${raw}')`);
  }
  return { seconds: Number(raw) };
}

export async function runRefreshCommand(input: RefreshInput): Promise<number> {
  const env = resolveEnv(input);

  if (input.args.seconds === undefined) {
    const { config } = await loadConfig({ env });
    process.stdout.write(`${config.refreshInterval}\n`);
    return 0;
  }

  const seconds = input.args.seconds;
  const home = input.home ?? homedir();
  await saveSetRefreshInterval(seconds, { env });
  const cfgPath = resolveConfigPaths(env).userConfig;
  const result = await syncRefreshInterval(home, seconds);

  const setMsg =
    seconds === 0
      ? `agentline: refresh interval disabled (0) in ${cfgPath}`
      : `agentline: refresh interval set to ${seconds}s in ${cfgPath}`;

  switch (result.kind) {
    case "written":
      process.stdout.write(
        `${setMsg}; wired statusLine.refreshInterval=${seconds} in ${result.path}\n`,
      );
      return 0;
    case "removed":
      process.stdout.write(`${setMsg}; removed statusLine.refreshInterval from ${result.path}\n`);
      return 0;
    case "unchanged":
      process.stdout.write(`${setMsg}; ${result.path} already in sync\n`);
      return 0;
    case "not-wired":
      process.stdout.write(
        `${setMsg}.\n` +
          "agentline: statusLine is not wired to agentline yet — run `agentline install` to apply it.\n",
      );
      return 0;
  }
}

export async function runRefreshSubgroup(rest: readonly string[]): Promise<number> {
  return runRefreshCommand({ args: parseRefreshArgs(rest) });
}
