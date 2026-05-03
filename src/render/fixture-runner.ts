/**
 * In-process render replay used by the doctor's D10 check, the CLI's
 * `agentline render --fixture` flag, and the golden tests harness
 * (§11.3).
 *
 * Routes through the real pipeline (`renderFromInputs`) so doctor
 * passing means the path the user actually sees on every statusline
 * tick is healthy. Optional inputs let goldens pin config / theme /
 * frozen clock / terminal width / accessibility flags.
 */

import { Readable } from "node:stream";
import { promises as fs } from "node:fs";

import { DEFAULT_CONFIG } from "../config/defaults.js";
import { validateConfig } from "../config/validate.js";
import type { AgentlineConfig } from "../config/types.js";
import type { Theme } from "../theme/index.js";
import { frozenClock, realClock, type Clock } from "../widgets/clock.js";
import { readStdinPayload } from "../stdin/index.js";

import type { AccessibilityFlags } from "./accessibility.js";
import { renderFromInputs } from "./pipeline.js";

export interface RenderForFixtureOptions {
  readonly config?: AgentlineConfig;
  readonly configPath?: string;
  readonly theme?: Theme | null;
  readonly clock?: Clock;
  readonly frozenClockISO?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly width?: number;
  readonly flags?: AccessibilityFlags;
}

export async function renderForFixture(
  stdinJson: string,
  options: RenderForFixtureOptions = {},
): Promise<string> {
  const stream = Readable.from([Buffer.from(stdinJson, "utf8")]);
  const payload = await readStdinPayload(stream);
  const config = await resolveConfig(options);
  const theme = options.theme ?? null;
  const clock = resolveClock(options);
  return renderFromInputs({
    payload,
    config,
    theme,
    clock,
    ...(options.env !== undefined ? { env: options.env } : {}),
    ...(options.width !== undefined ? { width: options.width } : {}),
    ...(options.flags !== undefined ? { flags: options.flags } : {}),
  });
}

async function resolveConfig(options: RenderForFixtureOptions): Promise<AgentlineConfig> {
  if (options.config) return options.config;
  if (options.configPath) {
    const raw = await fs.readFile(options.configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    validateConfig(parsed);
    return parsed as AgentlineConfig;
  }
  return DEFAULT_CONFIG;
}

function resolveClock(options: RenderForFixtureOptions): Clock {
  if (options.clock) return options.clock;
  if (options.frozenClockISO) return frozenClock(options.frozenClockISO);
  return realClock;
}
