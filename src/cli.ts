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
import { parseSchemaArgs, runSchemaCommand } from "./schema/command.js";
import { parseDoctorArgs, runDoctorCommand } from "./doctor/command.js";
import { parseInitArgs, runInitCommand } from "./init/command.js";
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
    if (err instanceof StdinParseError) {
      process.stdout.write("agentline: invalid stdin\n");
      return 1;
    }
    process.stderr.write(`agentline: render error: ${(err as Error).message}\n`);
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
      "  (default)            read stdin JSON, render statusline, write to stdout",
      "  render [--fixture]   re-render against a recorded payload (PR 18)",
      "  config               TUI editor (PR 16)",
      "  doctor [--fix]       diagnose + repair host wiring (PR 17)",
      "  init [--minimal]     scaffold project config (PR 18)",
      "  keys [--json]        list active keymap (PR 18)",
      "  schema [--write]     print or write the config JSON Schema (PR 6)",
      "  themes [--list]      inspect theme presets (PR 18)",
      "  version              print version",
      "  help                 print this message",
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
      try {
        return await runSchemaCommand(parseSchemaArgs(rest));
      } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        return 2;
      }
    case "doctor":
      try {
        return await runDoctorCommand(parseDoctorArgs(rest));
      } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        return 2;
      }
    case "config":
      try {
        return await runConfigDispatch();
      } catch (err) {
        process.stderr.write(`agentline: config error: ${(err as Error).message}\n`);
        return 1;
      }
    case "init":
      try {
        return await runInitCommand({ args: parseInitArgs(rest) });
      } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        return 2;
      }
    case "keys":
      try {
        return await runKeysCommand({ args: parseKeysArgs(rest) });
      } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        return 2;
      }
    case "themes":
      try {
        return await runThemesCommand({ args: parseThemesArgs(rest) });
      } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        return 2;
      }
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
