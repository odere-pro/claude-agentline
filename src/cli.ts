/**
 * agentline CLI entry point.
 *
 * Subcommand bodies live under their owner directories
 * (`src/doctor`, `src/render`, `src/tui`, …); this file is
 * dispatch-only.
 *
 * Top-level surface: render (default) / edit / install /
 * uninstall / doctor / help / version.
 *
 * The default invocation (no subcommand) runs the render path:
 * read stdin, render the merged statusline, write to stdout.
 */

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { StdinParseError } from "./stdin/index.js";
import { AGENTLINE_VERSION } from "./version.js";
import { HelpRequestedError, isHelpFlag, requestHelp } from "./cli/help.js";
import { parseDoctorArgs, runDoctorCommand } from "./doctor/command.js";
import { parseInstallArgs, runInstallCommand } from "./install/command.js";
import { parseUninstallArgs, runUninstallCommand } from "./uninstall/command.js";
import { parseRenderArgs, runRenderCommand } from "./render/fixture-command.js";
import { parseStartArgs, runStartCommand } from "./start/command.js";
import { runWidgetSubgroup } from "./config/widget-command.js";

type ParsedArgs = {
  command: string;
  rest: string[];
};

// Global flags handled at the top level (mirrors the convention used
// with Claude Code: `--help`/`-h` and `--version`/`-v` are flags, not
// subcommands). Recognised here so they aren't swept into `render`.
const GLOBAL_FLAGS: ReadonlySet<string> = new Set(["--help", "-h", "--version", "-v"]);

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  if (args.length === 0) return { command: "render", rest: [] };
  const first = args[0]!;
  if (GLOBAL_FLAGS.has(first)) return { command: first, rest: args.slice(1) };
  if (first.startsWith("-")) return { command: "render", rest: args };
  return { command: first, rest: args.slice(1) };
}

async function runRender(rest: readonly string[]): Promise<number> {
  try {
    return await runRenderCommand({ args: parseRenderArgs(rest) });
  } catch (err) {
    if (err instanceof HelpRequestedError) {
      process.stdout.write(err.body);
      return 0;
    }
    if (err instanceof StdinParseError) {
      // stdout stays a single line because the host UI shows it inline
      // as the statusline. Detail goes to stderr where a human reading
      // the terminal can see what to do next.
      process.stdout.write("agentline: invalid stdin\n");
      process.stderr.write(
        [
          `agentline: ${(err as Error).message}`,
          "  expected: a JSON object on stdin (Claude Code statusline contract)",
          "  try: agentline doctor      # diagnose host wiring",
          "",
        ].join("\n"),
      );
      return 1;
    }
    process.stderr.write(
      [
        `agentline: render error: ${(err as Error).message}`,
        "  try: agentline doctor              # diagnose host wiring",
        "  try: agentline edit                # edit configuration",
        "",
      ].join("\n"),
    );
    return 1;
  }
}

function runVersion(): number {
  process.stdout.write(`agentline ${AGENTLINE_VERSION}\n`);
  return 0;
}

function runHelp(): number {
  process.stdout.write(
    [
      "Usage: agentline                   read JSON on stdin, render statusline (default)",
      "       agentline <command> [<options>]",
      "",
      "The default form is what Claude Code reads. Use the commands below to set it up.",
      "",
      "Commands:",
      "  install              wire agentline into Claude Code's statusline",
      "  uninstall            remove agentline + restore prior statusLine",
      "  doctor [--fix]       diagnose + repair host wiring",
      "  edit                 open the TUI editor",
      "  config widget <sub>  inspect or edit the statusline layout (scriptable)",
      "  start                preview the statusline using the last cached stdin",
      "  version              print version (alias: -v, --version)",
      "  help                 print this message (alias: -h, --help)",
      "",
      "Pass -h/--help to any command for details. Start with `agentline install`.",
      "",
    ].join("\n"),
  );
  return 0;
}

const CONFIG_HELP = `agentline config — inspect or edit the user config without the TUI

Usage:
  agentline config <group> [<options>]

Groups:
  widget <sub>   inspect or edit the statusline layout; see \`agentline config widget --help\`

For interactive editing with live preview, use \`agentline edit\` instead.
`;

async function runConfig(rest: readonly string[]): Promise<number> {
  const group = rest[0];
  if (group === undefined || isHelpFlag(group) || group === "help") {
    requestHelp(CONFIG_HELP);
  }
  const groupRest = rest.slice(1);
  switch (group) {
    case "widget":
      return runWidgetSubgroup(groupRest);
    default:
      process.stderr.write(`agentline config: unknown group '${group}'\n`);
      process.stdout.write(CONFIG_HELP);
      return 1;
  }
}

async function runEditor(): Promise<number> {
  // Lazy-import the TUI bundle. tsup builds it as a separate
  // `dist/tui.mjs` so Ink + React never hit cli.mjs's parse path
  // (§1.2 N3). Use a runtime URL so the static analyser does not
  // try to resolve `./tui.mjs` against the source tree (where
  // `tui` is a directory, not a module file).
  const moduleUrl = new URL("./tui.mjs", import.meta.url).href;
  const tui = (await import(moduleUrl)) as {
    runConfigCommand: () => Promise<{ saved: boolean }>;
  };
  await tui.runConfigCommand();
  return 0;
}

async function dispatch(exec: () => Promise<number>, errorPrefix?: string): Promise<number> {
  try {
    return await exec();
  } catch (err) {
    if (err instanceof HelpRequestedError) {
      process.stdout.write(err.body);
      return 0;
    }
    const message = (err as Error).message;
    process.stderr.write(errorPrefix ? `${errorPrefix}: ${message}\n` : `${message}\n`);
    return 2;
  }
}

/**
 * Top-level subcommand dispatch table. Each entry owns its arg-parsing
 * + run pair, plus an optional `errorPrefix` used when the run function
 * throws something other than `HelpRequestedError`.
 *
 * Aliases (e.g. `--version` for `version`) share a single entry so the
 * table stays the source of truth for "is this a known command?".
 *
 * `render` stays in the table so `agentline render --fixture …` keeps
 * working for ops/debug, but it is intentionally absent from the help
 * screen — the default no-arg path is the canonical surface.
 */
type Subcommand = (rest: readonly string[]) => Promise<number>;

export const COMMANDS: Readonly<Record<string, Subcommand>> = Object.freeze({
  render: runRender,
  version: async () => runVersion(),
  "--version": async () => runVersion(),
  "-v": async () => runVersion(),
  help: async () => runHelp(),
  "--help": async () => runHelp(),
  "-h": async () => runHelp(),
  doctor: (rest) => dispatch(() => runDoctorCommand(parseDoctorArgs([...rest]))),
  edit: () => dispatch(runEditor, "agentline edit"),
  install: (rest) => dispatch(() => runInstallCommand(parseInstallArgs(rest)), "agentline install"),
  uninstall: (rest) =>
    dispatch(() => runUninstallCommand(parseUninstallArgs(rest)), "agentline uninstall"),
  start: (rest) => dispatch(() => runStartCommand(parseStartArgs(rest)), "agentline start"),
  config: (rest) => dispatch(() => runConfig(rest), "agentline config"),
});

async function main(): Promise<number> {
  const { command, rest } = parseArgs(process.argv);
  const handler = COMMANDS[command];
  if (handler) return handler(rest);
  process.stderr.write(`agentline: unknown command '${command}'\n`);
  runHelp();
  return 1;
}

// Only auto-run when invoked as a script. Tests can import this module
// (e.g. for the COMMANDS dispatch table) without triggering main().
// Compares realpaths so a symlink (e.g. an npm-installed global bin
// pointing at dist/cli.mjs) still counts as a direct invocation.
function isDirectInvocation(): boolean {
  try {
    const entry = process.argv[1];
    if (!entry) return false;
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  main().then(
    (code) => {
      process.exit(code);
    },
    (err) => {
      process.stderr.write(`agentline: fatal: ${(err as Error).message}\n`);
      process.exit(1);
    },
  );
}
