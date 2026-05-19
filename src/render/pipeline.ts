/**
 * Real render pipeline (§8.2).
 *
 * Composes the widget surface, theme, Powerline transform, and ANSI
 * encoder into one synchronous-style entry point. Used by:
 *
 *   - `agentline render` (default + `--fixture`)
 *   - golden fixtures harness (PR 21)
 *   - doctor's D08 embedded fixture check
 *
 * Inputs are explicit so callers can drive the pipeline with a
 * frozen clock, an injected env, or an arbitrary stdin payload —
 * goldens depend on full input determinism (§11.3).
 *
 * Snapshots (`session`, `tokens`, `git`) are taken as inputs from
 * `RenderInputs` rather than loaded inside this pipeline. Widgets
 * that need a missing snapshot hide cleanly so the render remains
 * usable. Producers wire their loaders separately: the live render
 * path in `runRenderCommand` calls `loadLiveSnapshots`; doctor and
 * golden fixtures pin them deterministically.
 */

import { detectColourDepth } from "./colour-depth.js";
import { detectTerminalWidthInfo, applyWidthMode, NO_WRAP_WIDTH } from "./width.js";
import { applyAccessibility, effectiveDepth, honourNoColorEnv } from "./accessibility.js";
import { encodeSegments, SGR_RESET } from "./ansi.js";
import { composeLines } from "./compose.js";
import { buildWidgetContext } from "./context.js";
import type { RenderInputs } from "./inputs.js";
import type { Segment } from "./segment.js";

import type { AgentlineConfig } from "../config/types.js";
import { resolveEnv } from "../lib/env.js";
import { detectGlyphSupport } from "../powerline/index.js";
import { resolveRole, type Theme } from "../theme/index.js";
import type { Cell } from "../widgets/cell.js";
import { realClock, type Clock } from "../widgets/clock.js";
import { defaultRegistry, registerAllBuiltins } from "../widgets/index.js";
import { renderWidget } from "../widgets/render-widget.js";

export type { RenderInputs } from "./inputs.js";

/**
 * Maximum warning lines appended below the rendered statusline (Phase 2
 * item 9). Sized so a wildly-broken config can't bury the screen — six
 * is enough to surface the common bulk-mistype scenarios and short
 * enough to stay scannable.
 */
export const MAX_WARNING_LINES = 6;

function ensureRegistry(): void {
  const reg = defaultRegistry();
  /*
   * size() > 0 means the registry was already populated; this stays
   * coherent with resetDefaultRegistry() which clears the singleton.
   */
  if (reg.size() > 0) return;
  registerAllBuiltins(reg);
}

export function renderFromInputs(inputs: RenderInputs): string {
  ensureRegistry();
  const env = resolveEnv(inputs);
  const flags = honourNoColorEnv(inputs.flags ?? { noColor: false, noUnicode: false }, env);
  const clock: Clock = inputs.clock ?? realClock;
  /*
   * An explicit `inputs.width` (--width flag, golden fixture) is an
   * authoritative width — wrap against it. Otherwise resolve from the
   * environment; when nothing real is detected `noWrap` is set so the
   * composer emits one row per configured line instead of wrapping
   * against a guessed fallback.
   */
  const resolved =
    inputs.width !== undefined
      ? { width: inputs.width, noWrap: false }
      : resolveWidth(inputs.config, env);
  const width = resolved.width;
  const ctx = buildWidgetContext({
    payload: inputs.payload,
    config: inputs.config,
    theme: inputs.theme,
    clock,
    env,
    tokens: inputs.tokens,
    git: inputs.git,
    session: inputs.session,
    plan: inputs.plan,
  });

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
    noWrap: resolved.noWrap,
    glyphSupport: detectGlyphSupport(env),
  });

  const warnings = buildWarningLines(unknownTypes, inputs.theme);
  const allLines: Segment[][] = [...composed, ...warnings];

  const depth = effectiveDepth(detectColourDepth({ env }), flags);
  const encoded = allLines
    .map((segs) => {
      const accessible = applyAccessibility(segs, flags);
      const text = encodeSegments(accessible, depth);
      /*
       * Append SGR reset only when the line actually carried styled
       * bytes; otherwise a bare reset pollutes plain output and
       * breaks downstream byte-for-byte diffing.
       */
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
function buildWarningLines(unknownTypes: ReadonlySet<string>, theme: Theme | null): Segment[][] {
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

function resolveWidth(
  config: AgentlineConfig,
  env: NodeJS.ProcessEnv,
): { width: number; noWrap: boolean } {
  const detected = detectTerminalWidthInfo({ env });
  if (!detected.detected) {
    /*
     * No real width signal (the live host case: piped stdout, no
     * COLUMNS, no width on stdin). Don't apply `full-minus-40` to a
     * guessed 80 — that yields 40 columns and wraps/drops lines. Emit
     * one row per configured line and let the host clip horizontally.
     */
    return { width: NO_WRAP_WIDTH, noWrap: true };
  }
  return {
    width: applyWidthMode(detected.width, {
      mode: config.terminalWidth.mode,
      compactThreshold: config.terminalWidth.compactThreshold,
    }).effectiveWidth,
    noWrap: false,
  };
}
