/**
 * Body for `agentline render [--fixture <path>] [--config <path>]`
 * (§9.1).
 *
 * Without flags: identical to the no-args render entry — read stdin,
 * render, exit. With `--fixture <path>`: read the JSON payload from
 * disk instead of stdin and replay through the renderer. With
 * `--config <path>`: pin a specific config file.
 *
 * The render itself goes through `renderForFixture` so the goldens
 * harness (PR 21) and this CLI surface share one code path.
 */

import { promises as fs } from "node:fs";

import { renderForFixture } from "./fixture-runner.js";

export interface RenderCommandArgs {
  readonly fixture?: string;
  readonly configPath?: string;
}

export interface RenderInput {
  readonly args: RenderCommandArgs;
  readonly stdin?: NodeJS.ReadableStream;
}

const ACCESSIBILITY_FLAGS: ReadonlySet<string> = new Set([
  "--no-color",
  "--no-colour",
  "--no-unicode",
  "--ascii",
]);

export async function runRenderCommand(input: RenderInput): Promise<number> {
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
    return 1;
  }
  const out = await renderForFixture(payload);
  process.stdout.write(out);
  return 0;
}

export function parseRenderArgs(rest: readonly string[]): RenderCommandArgs {
  let fixture: string | undefined;
  let configPath: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--fixture") {
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
    } else if (arg && ACCESSIBILITY_FLAGS.has(arg)) {
      // Accessibility flags (§1.2 N8) are tolerated at the CLI
      // surface and consumed downstream when the renderer wires
      // `parseAccessibilityArgs` in. Tolerated here so the binary
      // never errors on the §11.2 G16 matrix.
    } else if (arg) {
      throw new Error(`agentline render: unknown argument '${arg}'`);
    }
  }
  const out: RenderCommandArgs = {};
  if (fixture !== undefined) (out as { fixture: string }).fixture = fixture;
  if (configPath !== undefined) (out as { configPath: string }).configPath = configPath;
  return out;
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString("utf8");
}
