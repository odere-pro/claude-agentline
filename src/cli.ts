/**
 * agentline CLI entry point.
 *
 * Subcommand bodies live under their owner directories
 * (`src/doctor`, `src/render`, `src/tui`, …); this file is
 * dispatch-only.
 *
 * Top-level surface: render (default) / edit / reset /
 * uninstall / doctor / config / help / version.
 * `install` is still dispatched but hidden from help — `reset`
 * is the user/agent-facing way to (re)apply defaults.
 *
 * The default invocation (no subcommand) runs the render path:
 * read stdin, render the merged statusline, write to stdout.
 */

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { StdinParseError } from "./core/stdin/index.js";
import { AGENTLINE_VERSION } from "./version.js";
import { HelpRequestedError, isHelpFlag, requestHelp } from "./commands/cli/help.js";
import { parseDoctorArgs, runDoctorCommand } from "./commands/doctor/command.js";
import { parseInstallArgs, runInstallCommand } from "./commands/install/command.js";
import { parseResetArgs, runResetCommand } from "./commands/reset/command.js";
import { parseUninstallArgs, runUninstallCommand } from "./commands/uninstall/command.js";
import { parseRenderArgs, runRenderCommand } from "./render/render/fixture-command.js";
import { detectColourDepth } from "./render/render/colour-depth.js";
import { effectiveDepth, honourNoColorEnv } from "./render/render/accessibility.js";
import { runWidgetSubgroup } from "./data/config/widget-command.js";

type ParsedArgs = {
  command: string;
  rest: string[];
};

/*
 * Global flags handled at the top level (mirrors the convention used
 * with Claude Code: `--help`/`-h` and `--version`/`-v` are flags, not
 * subcommands). Recognised here so they aren't swept into `render`.
 */
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
      /*
       * stdout stays a single line because the host UI shows it inline
       * as the statusline. Detail goes to stderr where a human reading
       * the terminal can see what to do next.
       */
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
      "  reset                reset agentline to defaults (reseed config + rewire)",
      "  uninstall            remove agentline + restore prior statusLine",
      "  doctor [--fix]       diagnose + repair host wiring",
      "  edit                 open the TUI editor",
      "  config widget <sub>  inspect or edit the statusline layout (scriptable)",
      "  version              print version (alias: -v, --version)",
      "  help                 print this message (alias: -h, --help)",
      "",
      "Pass -h/--help to any command for details. Start with `agentline reset`.",
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
  /*
   * The editor preview pre-resolves every widget colour to the exact
   * swatch the render bin would print at the detected colour depth
   * (see preview-model.ts `toHex`). Pin chalk to truecolor *before* the
   * TUI bundle — and its transitive chalk, whose level is fixed at
   * import — loads, so Ink emits that pre-resolved swatch verbatim
   * instead of re-downsampling it through chalk's own palette (which is
   * what made the preview look "milder" than the live bar). Skipped when
   * colour is disabled (NO_COLOR / dumb term) and never overrides an
   * explicit FORCE_COLOR the user set themselves.
   */
  const depth = effectiveDepth(
    detectColourDepth({ env: process.env }),
    honourNoColorEnv({ noColor: false, noUnicode: false }, process.env),
  );
  if (depth !== "none" && process.env["FORCE_COLOR"] === undefined) {
    process.env["FORCE_COLOR"] = "3";
  }
  /*
   * Lazy-import the TUI bundle. tsup builds it as a separate
   * `dist/tui.mjs` so Ink + React never hit cli.mjs's parse path
   * (§1.2 N3). Use a runtime URL so the static analyser does not
   * try to resolve `./tui.mjs` against the source tree (where
   * `tui` is a directory, not a module file).
   */
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
 *
 * `install` is likewise kept but hidden: npm/postinstall flows, the
 * `--from-source` dev path, and existing scripts/docs still invoke it.
 * `reset` is the user/agent-facing entry point (install steps plus a
 * forced config reseed); plain re-install would silently preserve a
 * stale config, which is the confusion this split removes.
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
  reset: (rest) => dispatch(() => runResetCommand(parseResetArgs(rest)), "agentline reset"),
  // Hidden from `runHelp()` but still dispatched (see table JSDoc above).
  install: (rest) => dispatch(() => runInstallCommand(parseInstallArgs(rest)), "agentline install"),
  uninstall: (rest) =>
    dispatch(() => runUninstallCommand(parseUninstallArgs(rest)), "agentline uninstall"),
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

/*
 * Only auto-run when invoked as a script. Tests can import this module
 * (e.g. for the COMMANDS dispatch table) without triggering main().
 * Compares realpaths so a symlink (e.g. an npm-installed global bin
 * pointing at dist/cli.mjs) still counts as a direct invocation.
 */
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
