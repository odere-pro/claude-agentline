/**
 * agentline CLI entry point.
 *
 * Subcommand bodies live under their owner directories
 * (`src/config`, `src/doctor`, `src/render`, `src/tui`, …);
 * this file is dispatch-only.
 *
 * The default invocation (no subcommand) runs the render path:
 * read stdin, render the merged statusline, write to stdout.
 * v0.1.0-pre: subcommand bodies are wired progressively over the
 * PR sequence in `docs/plan/PR-PLAN.md`. Until then the default
 * path emits a one-line ASCII fallback so the host UI is never blank.
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
import { parsePreviewArgs, runPreviewCommand } from "./preview/command.js";
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
          "  try: agentline preview     # see a working render with no stdin",
          "  try: agentline doctor      # diagnose host wiring",
          "",
        ].join("\n"),
      );
      return 1;
    }
    process.stderr.write(
      [
        `agentline: render error: ${(err as Error).message}`,
        "  try: agentline doctor          # diagnose host wiring",
        "  try: agentline config          # edit configuration",
        "  rebuild: agentline init --force --preset default",
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
      "  uninstall            remove agentline from this host",
      "  preview              render a sample statusline (no install, no stdin)",
      "  init [--preset ...]  scaffold a config (--preset, --scope, --force)",
      "  config               edit configuration in the TUI",
      "  doctor [--fix]       diagnose + repair host wiring",
      "  themes [--list]      inspect installed theme presets",
      "  keys [--json]        list active keymap",
      "  schema [--write]     print or write the config JSON Schema",
      "  render [--fixture]   re-render a recorded stdin payload",
      "  (default)            read stdin JSON, render statusline, write to stdout",
      "  version              print version",
      "  help                 print this message",
      "",
      "Pass -h/--help to any command for details. Start with `agentline install`.",
      "",
    ].join("\n"),
  );
  return 0;
}

async function runConfigDispatch(): Promise<number> {
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

async function dispatch(
  exec: () => Promise<number>,
  errorPrefix?: string,
): Promise<number> {
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

async function main(): Promise<number> {
  const { command, rest } = parseArgs(process.argv);
  switch (command) {
    case "render":
      return runRender(rest);
    case "version":
    case "--version":
    case "-v":
      return runVersion();
    case "help":
    case "--help":
    case "-h":
      return runHelp();
    case "schema":
      return dispatch(() => runSchemaCommand(parseSchemaArgs(rest)));
    case "doctor":
      return dispatch(() => runDoctorCommand(parseDoctorArgs(rest)));
    case "config":
      return dispatch(runConfigDispatch, "agentline: config error");
    case "install":
      return dispatch(() => runInstallCommand(parseInstallArgs(rest)), "agentline install");
    case "uninstall":
      return dispatch(() => runUninstallCommand(parseUninstallArgs(rest)), "agentline uninstall");
    case "init":
      return dispatch(() => runInitCommand({ args: parseInitArgs(rest) }));
    case "keys":
      return dispatch(() => runKeysCommand({ args: parseKeysArgs(rest) }));
    case "themes":
      return dispatch(() => runThemesCommand({ args: parseThemesArgs(rest) }));
    case "preview":
      return dispatch(
        () => runPreviewCommand({ args: parsePreviewArgs(rest) }),
        "agentline preview",
      );
    default:
      process.stderr.write(`agentline: unknown command '${command}'\n`);
      runHelp();
      return 1;
  }
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
