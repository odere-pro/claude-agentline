/**
 * In-process render replay used by the doctor's D08 check, the CLI's
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

import { DEFAULT_CONFIG } from "../../data/config/defaults.js";
import { validateConfig } from "../../data/config/validate.js";
import type { AgentlineConfig } from "../../data/config/types.js";
import type { Theme } from "../../data/theme/index.js";
import { resolveConfiguredTheme } from "../../data/theme/resolve.js";
import { frozenClock, realClock, type Clock } from "../../widgets/clock.js";
import { isPlainObject } from "../../core/lib/object.js";
import { readStdinPayload } from "../../core/stdin/index.js";

import type { AccessibilityFlags } from "./accessibility.js";
import { renderFromInputs } from "./pipeline.js";
import type { TokensSnapshot } from "../../data/tokens/index.js";
import type { GitState } from "../../data/git/index.js";
import type { ResolvedSessionFields } from "../../data/session/index.js";
import type { PlanSnapshot } from "../../data/session/plan.js";

export interface RenderForFixtureOptions {
  readonly config?: AgentlineConfig;
  readonly configPath?: string;
  /**
   * Resolved theme. When omitted, `config.theme` is loaded from the search
   * path; pass `null` explicitly to suppress that (e.g. goldens that pin
   * "no theme"). Pass a `Theme` to pin a specific palette.
   */
  readonly theme?: Theme | null;
  readonly clock?: Clock;
  readonly frozenClockISO?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly width?: number;
  readonly flags?: AccessibilityFlags;
  readonly tokens?: TokensSnapshot;
  readonly git?: GitState;
  readonly session?: ResolvedSessionFields;
  readonly plan?: PlanSnapshot;
  /** Override the bundled themes directory; primarily used by tests. */
  readonly builtinThemesDir?: string;
}

export async function renderForFixture(
  stdinJson: string,
  options: RenderForFixtureOptions = {},
): Promise<string> {
  const stream = Readable.from([Buffer.from(stdinJson, "utf8")]);
  const payload = await readStdinPayload(stream);
  const config = await resolveConfig(options);
  /*
   * `theme: null` means "no theme — keep defaults"; `theme: undefined`
   * means "fall back to config.theme". Goldens pass `null` explicitly.
   */
  const theme =
    options.theme !== undefined
      ? options.theme
      : await resolveConfiguredTheme(config.theme, {
          ...(options.env !== undefined ? { env: options.env } : {}),
          ...(options.builtinThemesDir !== undefined
            ? { builtinDir: options.builtinThemesDir }
            : {}),
        });
  const clock = resolveClock(options);
  return renderFromInputs({
    payload,
    config,
    theme,
    clock,
    ...(options.env !== undefined ? { env: options.env } : {}),
    ...(options.width !== undefined ? { width: options.width } : {}),
    ...(options.flags !== undefined ? { flags: options.flags } : {}),
    ...(options.tokens !== undefined ? { tokens: options.tokens } : {}),
    ...(options.git !== undefined ? { git: options.git } : {}),
    ...(options.session !== undefined ? { session: options.session } : {}),
    ...(options.plan !== undefined ? { plan: options.plan } : {}),
  });
}

async function resolveConfig(options: RenderForFixtureOptions): Promise<AgentlineConfig> {
  if (options.config) return options.config;
  if (options.configPath) {
    const raw = await fs.readFile(options.configPath, "utf8");
    const parsed = stripPrototypeKeys(JSON.parse(raw));
    validateConfig(parsed);
    return parsed;
  }
  return DEFAULT_CONFIG;
}

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/*
 * AJV blocks unknown top-level keys, but `widgets[].options` and `palette`
 * declare additionalProperties: true so a `__proto__` nested under those
 * would survive validation. Strip recursively before validate to keep the
 * merge layer's defence in depth (merge.ts) symmetric on the fixture path.
 */
function stripPrototypeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPrototypeKeys);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = stripPrototypeKeys(v);
  }
  return out;
}

function resolveClock(options: RenderForFixtureOptions): Clock {
  if (options.clock) return options.clock;
  if (options.frozenClockISO) return frozenClock(options.frozenClockISO);
  return realClock;
}
