/**
 * `agentline start` — preview the configured statusline using the last
 * cached stdin payload.
 *
 * After saving a config in the TUI editor (or editing it by hand) the
 * line wired into Claude Code's statusline contract only refreshes when
 * Claude Code invokes agentline again. `start` replays the last payload
 * the bin received from Claude Code through the real render pipeline so
 * the user can see the result immediately.
 *
 * When no cached payload exists yet (fresh install, agentline has not
 * yet been wired into Claude Code), prints a hint instead of an empty
 * statusline so the user knows why nothing rendered.
 */

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { readLastStdinSync } from "../state/stdin-cache.js";
import { renderForFixture } from "../render/fixture-runner.js";
import { parseAccessibilityArgs, type AccessibilityFlags } from "../render/accessibility.js";

const HELP = `agentline start — preview the configured statusline

Usage:
  agentline start [--no-color | --no-unicode | --ascii ...]

Replays the most recent stdin payload sent from Claude Code to agentline
so you can see how your current config will render without waiting for
the next Claude Code session to invoke the bin.

Options:
  --no-color, --ascii   accessibility flags
  -h, --help            show this message
`;

const ACCESSIBILITY_FLAGS: ReadonlySet<string> = new Set([
  "--no-color",
  "--no-colour",
  "--no-unicode",
  "--ascii",
]);

export interface StartArgs {
  readonly accessibility: AccessibilityFlags;
}

export function parseStartArgs(rest: readonly string[]): StartArgs {
  const accessibilityArgv: string[] = [];
  for (const arg of rest) {
    if (isHelpFlag(arg)) requestHelp(HELP);
    if (ACCESSIBILITY_FLAGS.has(arg)) {
      accessibilityArgv.push(arg);
      continue;
    }
    throw new Error(`agentline start: unknown argument '${arg}'`);
  }
  return { accessibility: parseAccessibilityArgs(accessibilityArgv) };
}

export async function runStartCommand(args: StartArgs): Promise<number> {
  const cached = readLastStdinSync();
  if (!cached) {
    process.stderr.write(
      [
        "agentline start: no cached stdin payload yet.",
        "  Claude Code invokes agentline on every prompt — start a Claude Code session",
        "  once so the bin records a payload, then run `agentline start` again.",
        "",
      ].join("\n"),
    );
    return 1;
  }
  const out = await renderForFixture(JSON.stringify(cached.payload), {
    flags: args.accessibility,
  });
  process.stdout.write(out);
  if (!out.endsWith("\n")) process.stdout.write("\n");
  return 0;
}
