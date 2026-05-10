/**
 * agentline CLI entry point.
 *
 * Subcommand bodies live under their owner directories
 * (`src/config`, `src/doctor`, `src/render`, `src/tui`, …);
 * this file is dispatch-only.
 *
 * Top-level surface (v0.1.0): install / uninstall / doctor / config.
 * Configuration-adjacent commands (init, theme, keys, schema, the TUI
 * editor) are second-level under `agentline config <sub>` so the
 * top-level `--help` stays small.
 *
 * The default invocation (no subcommand) runs the render path:
 * read stdin, render the merged statusline, write to stdout.
 */

import { StdinParseError } from "./stdin/index.js";
import { AGENTLINE_VERSION } from "./version.js";
import { HelpRequestedError } from "./cli/help.js";
import { parseSchemaArgs, runSchemaCommand } from "./schema/command.js";
import { parseDoctorArgs, runDoctorCommand } from "./doctor/command.js";
import { parseInitArgs, runInitCommand } from "./init/command.js";
import { parseInstallArgs, runInstallCommand } from "./install/command.js";
import { parseUninstallArgs, runUninstallCommand } from "./uninstall/command.js";
import { parseKeysArgs, runKeysCommand } from "./keys/command.js";
import { parseThemesArgs, runThemesCommand } from "./theme/command.js";
import { parseRenderArgs, runRenderCommand } from "./render/fixture-command.js";

type ParsedArgs = {
  command: string;
  rest: string[];
};

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  if (args.length === 0) return { command: "render", rest: [] };
  const first = args[0]!;
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
        "  try: agentline config              # edit configuration",
        "  rebuild: agentline config init --force --preset default",
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
      "Usage: agentline [<command>] [<options>]",
      "",
      "Commands:",
      "  install              wire agentline into Claude Code's statusline",
      "  uninstall            remove agentline + restore prior statusLine",
      "  doctor [--fix]       diagnose + repair host wiring",
      "  config [<sub>]       configuration subgroup (see `agentline config --help`)",
      "  (default, stdin)     read JSON, render statusline, write to stdout",
      "  version              print version",
      "  help                 print this message",
      "",
      "Pass -h/--help to any command for details. Start with `agentline install`.",
      "",
    ].join("\n"),
  );
  return 0;
}

function runConfigHelp(): number {
  process.stdout.write(
    [
      "Usage: agentline config [<sub>] [<options>]",
      "",
      "Subcommands:",
      "  (no sub)             open the TUI editor",
      "  edit                 open the TUI editor",
      "  init [--preset ...]  scaffold a config file from a preset",
      "  theme [--list]       inspect installed theme presets",
      "  keys [--json]        list the TUI editor keymap",
      "  schema [--write]     print or write the config JSON Schema",
      "  help                 print this message",
      "",
      "Pass -h/--help to any subcommand for details.",
      "",
    ].join("\n"),
  );
  return 0;
}

async function runConfigEditor(): Promise<number> {
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
 * `agentline config` second-level dispatcher. Bare invocation opens the
 * TUI editor; named sub-subcommands (init, theme, keys, schema) route to
 * the existing parse+run helpers. Aliases: `themes` (plural) for `theme`,
 * `edit` as an explicit alias for the bare form.
 */
async function runConfigSubgroup(rest: readonly string[]): Promise<number> {
  const sub = rest[0];
  if (sub === undefined || sub === "edit") {
    return dispatch(runConfigEditor, "agentline: config error");
  }
  if (sub === "-h" || sub === "--help" || sub === "help") {
    return runConfigHelp();
  }
  const subRest = rest.slice(1);
  switch (sub) {
    case "init":
      return dispatch(
        () => runInitCommand({ args: parseInitArgs(subRest) }),
        "agentline config init",
      );
    case "theme":
    case "themes":
      return dispatch(
        () => runThemesCommand({ args: parseThemesArgs(subRest) }),
        "agentline config theme",
      );
    case "keys":
      return dispatch(
        () => runKeysCommand({ args: parseKeysArgs(subRest) }),
        "agentline config keys",
      );
    case "schema":
      return dispatch(
        () => runSchemaCommand(parseSchemaArgs([...subRest])),
        "agentline config schema",
      );
    default:
      process.stderr.write(`agentline config: unknown subcommand '${sub}'\n`);
      runConfigHelp();
      return 1;
  }
}

/**
 * Top-level subcommand dispatch table (Command Map). Each entry owns
 * its arg-parsing + run pair, plus an optional `errorPrefix` used when
 * the run function throws something other than `HelpRequestedError`.
 *
 * Aliases (e.g. `--version` for `version`) share a single entry so the
 * table stays the source of truth for "is this a known command?".
 *
 * `render` stays in the table so `agentline render --fixture …` keeps
 * working for ops/debug, but it is intentionally absent from the help
 * screen — the default no-arg path is the canonical surface.
 */
type Subcommand = (rest: readonly string[]) => Promise<number>;

const COMMANDS: Readonly<Record<string, Subcommand>> = Object.freeze({
  render: runRender,
  version: async () => runVersion(),
  "--version": async () => runVersion(),
  "-v": async () => runVersion(),
  help: async () => runHelp(),
  "--help": async () => runHelp(),
  "-h": async () => runHelp(),
  doctor: (rest) => dispatch(() => runDoctorCommand(parseDoctorArgs([...rest]))),
  config: (rest) => runConfigSubgroup(rest),
  install: (rest) => dispatch(() => runInstallCommand(parseInstallArgs(rest)), "agentline install"),
  uninstall: (rest) =>
    dispatch(() => runUninstallCommand(parseUninstallArgs(rest)), "agentline uninstall"),
});

async function main(): Promise<number> {
  const { command, rest } = parseArgs(process.argv);
  const handler = COMMANDS[command];
  if (handler) return handler(rest);
  process.stderr.write(`agentline: unknown command '${command}'\n`);
  runHelp();
  return 1;
}

main().then(
  (code) => {
    process.exit(code);
  },
  (err) => {
    process.stderr.write(`agentline: fatal: ${(err as Error).message}\n`);
    process.exit(1);
  },
);
