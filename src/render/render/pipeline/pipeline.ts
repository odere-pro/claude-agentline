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

import { detectColourDepth } from "../colour-depth/colour-depth.js";
import { detectTerminalWidthInfo, NO_WRAP_WIDTH } from "../width/width.js";
import {
  applyAccessibility,
  effectiveDepth,
  honourNoColorEnv,
} from "../accessibility/accessibility.js";
import { encodeSegments, SGR_RESET } from "../ansi/ansi.js";
import { composeLines } from "../compose/compose.js";
import { buildWidgetContext } from "../context.js";
import type { RenderInputs } from "../inputs.js";

import { resolveEnv } from "../../../core/lib/env/env.js";
import { detectGlyphSupport } from "../../powerline/index.js";
import type { Cell } from "../../../widgets/cell/cell.js";
import { realClock, type Clock } from "../../../widgets/clock/clock.js";
import { defaultRegistry, registerAllBuiltins } from "../../../widgets/index.js";
import { renderWidget } from "../../../widgets/render-widget/render-widget.js";

export type { RenderInputs } from "../inputs.js";

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
   * authoritative width — elide against it. Otherwise resolve from the
   * environment; when nothing real is detected `noWrap` is set so the
   * composer elides nothing and lets the host clip. Either way a
   * configured line yields exactly one row (issue #304).
   */
  const resolved =
    inputs.width !== undefined
      ? { width: inputs.width, noWrap: false }
      : resolveWidth(env);
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

  /*
   * An unrecognised widget type renders as a hidden cell and is otherwise
   * silent (issue #311). `agentline doctor` D11 is the reporting channel:
   * warning rows below the statusline would add physical rows, reintroducing
   * the variable row count that #304 removed and that corrupts the host's
   * erase-and-redraw accounting.
   */
  const registry = defaultRegistry();
  const lines: Cell[][] = inputs.config.lines.map((line) =>
    line.widgets.map((w) => renderWidget(registry, w, ctx)).filter((c) => !c.hidden),
  );

  const composed = composeLines(lines, {
    global: inputs.config.global,
    powerline: inputs.config.powerline,
    theme: inputs.theme,
    width,
    noWrap: resolved.noWrap,
    glyphSupport: detectGlyphSupport(env),
  });

  const depth = effectiveDepth(detectColourDepth({ env }), flags);
  const encoded = composed
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

function hasStyle(
  segs: readonly { fg?: unknown; bg?: unknown; bold?: boolean; italic?: boolean }[],
): boolean {
  for (const s of segs) {
    if (s.fg !== undefined || s.bg !== undefined || s.bold || s.italic) return true;
  }
  return false;
}

function resolveWidth(env: NodeJS.ProcessEnv): { width: number; noWrap: boolean } {
  const detected = detectTerminalWidthInfo({ env });
  if (!detected.detected) {
    /*
     * No real width signal. Not the live host case — the host copies
     * `COLUMNS`/`LINES` from its own tty into the statusline command's
     * env — but it does cover pipes, cron, and fixture replays. Eliding
     * against a guessed 80 would drop content for no reason. Let the
     * host clip horizontally.
     */
    return { width: NO_WRAP_WIDTH, noWrap: true };
  }
  /*
   * Compose against the full detected width. Reserving columns for host
   * chrome only hides widgets the user asked for (issue #318).
   */
  return { width: detected.width, noWrap: false };
}
