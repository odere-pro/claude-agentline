/**
 * Real render pipeline (§8.2).
 *
 * Composes the widget surface, theme, Powerline transform, and ANSI
 * encoder into one synchronous-style entry point. Used by:
 *
 *   - `agentline render` (default + `--fixture`)
 *   - golden fixtures harness (PR 21)
 *   - doctor's D10 embedded fixture check
 *
 * Inputs are explicit so callers can drive the pipeline with a
 * frozen clock, an injected env, or an arbitrary stdin payload —
 * goldens depend on full input determinism (§11.3).
 *
 * Snapshots (`session`, `tokens`, `git`) stay undefined here. The
 * widgets that need them hide cleanly when absent so the render
 * remains usable; producers wire their loaders in via separate
 * follow-ups (Doctor + cli already load session / tokens; git
 * snapshot loading is left to the no-args render path).
 */

import { detectColourDepth } from "./colour-depth.js";
import { detectTerminalWidth, applyWidthMode } from "./width.js";
import {
  applyAccessibility,
  effectiveDepth,
  honourNoColorEnv,
  type AccessibilityFlags,
} from "./accessibility.js";
import { encodeSegments, SGR_RESET } from "./ansi.js";
import { composeLines } from "./compose.js";

import { detectGlyphSupport } from "../powerline/index.js";
import type { AgentlineConfig } from "../config/types.js";
import type { Theme } from "../theme/index.js";
import type { Cell } from "../widgets/cell.js";
import type { Clock } from "../widgets/clock.js";
import type { WidgetContext } from "../widgets/context.js";
import { realClock } from "../widgets/clock.js";
import { renderWidget } from "../widgets/render-widget.js";
import { defaultRegistry } from "../widgets/registry.js";
import { registerSessionWidgets } from "../widgets/session/index.js";
import { registerTokenWidgets } from "../widgets/tokens/index.js";
import { registerContextWidgets } from "../widgets/context/index.js";
import { registerRateLimitWidgets } from "../widgets/rate-limits/index.js";
import { registerGitWidgets } from "../widgets/git/index.js";
import { registerTimeWidgets } from "../widgets/time/index.js";
import { registerCustomWidgets } from "../widgets/custom/index.js";
import type { StdinPayload } from "../stdin/index.js";

let registryReady = false;

function ensureRegistry(): void {
  if (registryReady) return;
  const reg = defaultRegistry();
  registerSessionWidgets(reg);
  registerTokenWidgets(reg);
  registerContextWidgets(reg);
  registerRateLimitWidgets(reg);
  registerGitWidgets(reg);
  registerTimeWidgets(reg);
  registerCustomWidgets(reg);
  registryReady = true;
}

export interface RenderInputs {
  readonly payload: StdinPayload;
  readonly config: AgentlineConfig;
  readonly theme: Theme | null;
  readonly clock?: Clock;
  readonly env?: NodeJS.ProcessEnv;
  readonly width?: number;
  readonly flags?: AccessibilityFlags;
}

export function renderFromInputs(inputs: RenderInputs): string {
  ensureRegistry();
  const env = inputs.env ?? process.env;
  const flags = honourNoColorEnv(
    inputs.flags ?? { noColor: false, noUnicode: false },
    env,
  );
  const clock: Clock = inputs.clock ?? realClock;
  const width = inputs.width ?? resolveWidth(inputs.config, env);
  const ctx: WidgetContext = {
    stdin: inputs.payload,
    config: inputs.config,
    theme: inputs.theme,
    clock,
    env,
  };

  const registry = defaultRegistry();
  const lines: Cell[][] = inputs.config.lines.map((line) =>
    line.widgets
      .map((w) => renderWidget(registry, w, ctx))
      .filter((c) => !c.hidden),
  );

  const composed = composeLines(lines, {
    global: inputs.config.global,
    powerline: inputs.config.powerline,
    theme: inputs.theme,
    width,
    glyphSupport: detectGlyphSupport(env),
  });

  const depth = effectiveDepth(detectColourDepth({ env }), flags);
  const encoded = composed
    .map((segs) => {
      const accessible = applyAccessibility(segs, flags);
      const text = encodeSegments(accessible, depth);
      // Append SGR reset only when the line actually carried styled
      // bytes; otherwise a bare reset pollutes plain output and
      // breaks downstream byte-for-byte diffing.
      const styled = depth !== "none" && hasStyle(accessible);
      return styled ? `${text}${SGR_RESET}` : text;
    })
    .join("\n");
  return `${encoded}\n`;
}

function hasStyle(
  segs: readonly { fg?: unknown; bg?: unknown; bold?: boolean; italic?: boolean }[],
): boolean {
  for (const s of segs) {
    if (s.fg !== undefined || s.bg !== undefined || s.bold || s.italic) return true;
  }
  return false;
}

function resolveWidth(config: AgentlineConfig, env: NodeJS.ProcessEnv): number {
  const detected = detectTerminalWidth({ env });
  return applyWidthMode(detected, {
    mode: config.terminalWidth.mode,
    compactThreshold: config.terminalWidth.compactThreshold,
  }).effectiveWidth;
}
