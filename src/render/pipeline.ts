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
import type { Segment } from "./segment.js";

import { detectGlyphSupport } from "../powerline/index.js";
import type { AgentlineConfig } from "../config/types.js";
import { resolveRole, type Theme } from "../theme/index.js";
import type { Cell } from "../widgets/cell.js";
import type { Clock } from "../widgets/clock.js";
import type { WidgetContext } from "../widgets/context.js";
import { realClock } from "../widgets/clock.js";
import { renderWidget } from "../widgets/render-widget.js";
import { defaultRegistry, registerAllBuiltins } from "../widgets/index.js";
import type { TokensSnapshot } from "../tokens/index.js";
import type { GitState } from "../git/index.js";
import type { StdinPayload } from "../stdin/index.js";
import { resolveEnv } from "../lib/env.js";

/**
 * Maximum warning lines appended below the rendered statusline (Phase 2
 * item 9). Sized so a wildly-broken config can't bury the screen — six
 * is enough to surface the common bulk-mistype scenarios and short
 * enough to stay scannable.
 */
export const MAX_WARNING_LINES = 6;

function ensureRegistry(): void {
  const reg = defaultRegistry();
  // size() > 0 means the registry was already populated; this stays
  // coherent with resetDefaultRegistry() which clears the singleton.
  if (reg.size() > 0) return;
  registerAllBuiltins(reg);
}

export interface RenderInputs {
  readonly payload: StdinPayload;
  readonly config: AgentlineConfig;
  readonly theme: Theme | null;
  readonly clock?: Clock;
  readonly env?: NodeJS.ProcessEnv;
  readonly width?: number;
  readonly flags?: AccessibilityFlags;
  readonly tokens?: TokensSnapshot;
  readonly git?: GitState;
}

export function renderFromInputs(inputs: RenderInputs): string {
  ensureRegistry();
  const env = resolveEnv(inputs);
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
    ...(inputs.tokens !== undefined ? { tokens: inputs.tokens } : {}),
    ...(inputs.git !== undefined ? { git: inputs.git } : {}),
  };

  const registry = defaultRegistry();
  const unknownTypes = new Set<string>();
  const lines: Cell[][] = inputs.config.lines.map((line) =>
    line.widgets
      .map((w) => {
        if (!registry.get(w.type)) unknownTypes.add(w.type);
        return renderWidget(registry, w, ctx);
      })
      .filter((c) => !c.hidden),
  );

  const composed = composeLines(lines, {
    global: inputs.config.global,
    powerline: inputs.config.powerline,
    theme: inputs.theme,
    width,
    glyphSupport: detectGlyphSupport(env),
  });

  const warnings = buildWarningLines(unknownTypes, inputs.theme);
  const allLines: Segment[][] = [...composed, ...warnings];

  const depth = effectiveDepth(detectColourDepth({ env }), flags);
  const encoded = allLines
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

/**
 * Compose the trailing warning channel — one line per warning,
 * deduplicated and capped at `MAX_WARNING_LINES`. Each line is a
 * single coloured segment so the encoder treats it uniformly with
 * the regular render path.
 *
 * Currently only `unknown widget type: <type>` is surfaced. Other
 * warning sources (load-time validation failures, deprecated types)
 * can join the same pipeline by appending to the array before this
 * function is called.
 */
function buildWarningLines(
  unknownTypes: ReadonlySet<string>,
  theme: Theme | null,
): Segment[][] {
  if (unknownTypes.size === 0) return [];
  const fg = resolveRole(theme, "danger");
  const messages = [...unknownTypes]
    .sort()
    .slice(0, MAX_WARNING_LINES)
    .map((type) => `agentline: unknown widget type '${type}'`);
  return messages.map((text) => [{ text, fg }]);
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
