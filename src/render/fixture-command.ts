/**
 * Body for `agentline render` (§9.1, §11.3).
 *
 *   - default        read stdin, render, exit.
 *   - --fixture <p>  read the JSON payload from disk instead.
 *   - --config <p>   pin a specific config file (golden harness).
 *   - --frozen-clock <iso>  inject a deterministic clock so the
 *                            same fixture renders byte-identically
 *                            on every host (§11.3 goldens).
 *   - --no-color / --no-colour / --no-unicode / --ascii
 *                    accessibility flags (§1.2 N8); honoured here.
 *
 * The render itself goes through `renderForFixture` so the golden
 * harness, doctor's D10 check, and this CLI surface share one
 * pipeline.
 */

import { promises as fs } from "node:fs";

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { resolveConfigPaths } from "../config/paths.js";
import { pathExists } from "../lib/fs.js";
import { parseAccessibilityArgs, type AccessibilityFlags } from "./accessibility.js";
import { renderForFixture } from "./fixture-runner.js";

const HELP = `agentline render — re-render a recorded stdin payload

Usage:
  agentline render [--fixture <path>] [--config <path>]
                   [--frozen-clock <iso>] [--width <n>]
                   [--no-color | --no-unicode | --ascii ...]

Options:
  --fixture <path>      read JSON payload from disk instead of stdin
  --config <path>       pin a specific config file (golden harness)
  --frozen-clock <iso>  inject a deterministic clock for byte-identical output
  --width <n>           force terminal width
  --no-color, --ascii   accessibility flags
  -h, --help            show this message

The default invocation (no \`render\` subcommand) reads stdin directly;
this subcommand exists for replaying fixtures and goldens.
`;

export interface RenderCommandArgs {
  readonly fixture?: string;
  readonly configPath?: string;
  readonly frozenClockISO?: string;
  readonly width?: number;
  readonly accessibility: AccessibilityFlags;
}

export interface RenderCommandInput {
  readonly args: RenderCommandArgs;
  readonly stdin?: NodeJS.ReadableStream;
}

const ACCESSIBILITY_FLAGS: ReadonlySet<string> = new Set([
  "--no-color",
  "--no-colour",
  "--no-unicode",
  "--ascii",
]);

export async function runRenderCommand(input: RenderCommandInput): Promise<number> {
  const { fixture } = input.args;
  let payload: string;
  if (fixture) {
    try {
      payload = await fs.readFile(fixture, "utf8");
    } catch (err) {
      process.stderr.write(
        `agentline render: unable to read fixture ${fixture}: ${(err as Error).message}\n`,
      );
      return 1;
    }
  } else {
    payload = await readAll(input.stdin ?? process.stdin);
  }
  if (!payload.trim()) {
    process.stdout.write("agentline: empty stdin\n");
    if (!fixture) {
      process.stderr.write(
        "agentline: no JSON received on stdin. run `agentline doctor` to diagnose host wiring.\n",
      );
    }
    return 1;
  }
  // First-run hint: when this is a live render (no fixture, no --config)
  // and the user has not saved a config yet, point them at `agentline init`.
  // Suppressed for non-TTY stderr (so the host UI is unaffected) and when
  // AGENTLINE_QUIET=1 is set.
  if (!fixture && input.args.configPath === undefined) {
    await maybeEmitFirstRunHint();
  }
  const out = await renderForFixture(payload, {
    ...(input.args.configPath !== undefined ? { configPath: input.args.configPath } : {}),
    ...(input.args.frozenClockISO !== undefined
      ? { frozenClockISO: input.args.frozenClockISO }
      : {}),
    ...(input.args.width !== undefined ? { width: input.args.width } : {}),
    flags: input.args.accessibility,
  });
  process.stdout.write(out);
  return 0;
}

export function parseRenderArgs(rest: readonly string[]): RenderCommandArgs {
  let fixture: string | undefined;
  let configPath: string | undefined;
  let frozenClockISO: string | undefined;
  let width: number | undefined;
  const accessibilityArgv: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (isHelpFlag(arg)) {
      requestHelp(HELP);
    } else if (arg === "--fixture") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline render: --fixture requires a path");
      }
      fixture = next;
      i += 1;
    } else if (arg && arg.startsWith("--fixture=")) {
      fixture = arg.slice("--fixture=".length);
    } else if (arg === "--config") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline render: --config requires a path");
      }
      configPath = next;
      i += 1;
    } else if (arg && arg.startsWith("--config=")) {
      configPath = arg.slice("--config=".length);
    } else if (arg === "--frozen-clock") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline render: --frozen-clock requires an ISO timestamp");
      }
      frozenClockISO = next;
      i += 1;
    } else if (arg && arg.startsWith("--frozen-clock=")) {
      frozenClockISO = arg.slice("--frozen-clock=".length);
    } else if (arg === "--width") {
      const next = rest[i + 1];
      const parsed = next ? Number.parseInt(next, 10) : Number.NaN;
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("agentline render: --width requires a positive integer");
      }
      width = parsed;
      i += 1;
    } else if (arg && arg.startsWith("--width=")) {
      const parsed = Number.parseInt(arg.slice("--width=".length), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("agentline render: --width requires a positive integer");
      }
      width = parsed;
    } else if (arg && ACCESSIBILITY_FLAGS.has(arg)) {
      accessibilityArgv.push(arg);
    } else if (arg) {
      throw new Error(`agentline render: unknown argument '${arg}'`);
    }
  }
  const out: RenderCommandArgs = {
    accessibility: parseAccessibilityArgs(accessibilityArgv),
  };
  if (fixture !== undefined) (out as { fixture: string }).fixture = fixture;
  if (configPath !== undefined) (out as { configPath: string }).configPath = configPath;
  if (frozenClockISO !== undefined)
    (out as { frozenClockISO: string }).frozenClockISO = frozenClockISO;
  if (width !== undefined) (out as { width: number }).width = width;
  return out;
}

async function maybeEmitFirstRunHint(): Promise<void> {
  if (!process.stderr.isTTY) return;
  if (process.env.AGENTLINE_QUIET === "1") return;
  const paths = resolveConfigPaths(process.env);
  const hasUser = await pathExists(paths.userConfig);
  if (hasUser) return;
  process.stderr.write(
    "# agentline: using built-in defaults — `agentline init` to customise (silence with AGENTLINE_QUIET=1)\n",
  );
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString("utf8");
}
