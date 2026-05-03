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

import { readStdinPayload, StdinParseError } from "./stdin/index.js";
import { AGENTLINE_VERSION } from "./version.js";
import { parseSchemaArgs, runSchemaCommand } from "./schema/command.js";

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

async function runRender(_rest: string[]): Promise<number> {
  try {
    const payload = await readStdinPayload(process.stdin);
    const model = payload.model ?? "claude";
    const cwdLabel = payload.cwd ? ` · ${payload.cwd}` : "";
    process.stdout.write(`${model}${cwdLabel}\n`);
    return 0;
  } catch (err) {
    if (err instanceof StdinParseError) {
      process.stdout.write("agentline: invalid stdin\n");
      return 1;
    }
    process.stdout.write("agentline: render error\n");
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

function runUnimplemented(name: string): number {
  process.stderr.write(`agentline: subcommand '${name}' not yet wired in this build\n`);
  return 1;
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
    case "config":
    case "doctor":
    case "init":
    case "keys":
    case "themes":
      return runUnimplemented(command);
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
