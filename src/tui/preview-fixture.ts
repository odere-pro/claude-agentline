/**
 * Preview context for `agentline edit` (Phase 3 item 14).
 *
 * Replaces the retired demo fixture. Two modes, decided at first use:
 *
 *   - **real**  — a recent `last-stdin.json` cache exists. We rebuild
 *                 the same `WidgetContext` shape the live render would
 *                 see (stdin payload + resolved session, tokens, and
 *                 git snapshots), so widget previews show the user's
 *                 actual values — model, cwd, branch, token counts.
 *
 *   - **label** — no cache. Every widget renders its own type name
 *                 (`tokens-input`, `git-branch`, …) via
 *                 `renderWidgetLabel`. Honest about the absence of
 *                 data, navigable, and still surfaces per-widget
 *                 colour/style overrides so a user can audit cosmetic
 *                 choices.
 *
 * The mode is computed once per process and cached on a module-level
 * field. `resetPreviewModeCache()` exposes that cache to tests; the
 * TUI editor itself never touches it. The loaders we call here
 * (`loadSessionFields`, `loadTokensSnapshot`, `loadGitSnapshot`) all
 * use sync I/O, so this stays compatible with the synchronous
 * `previewWidget` call that Ink renders perform from React.
 */

import { DEFAULT_CONFIG } from "../config/defaults.js";
import type { AgentlineConfig, WidgetConfig } from "../config/types.js";
import type { GitState } from "../git/index.js";
import { buildWidgetContext, loadLiveSnapshots } from "../render/context.js";
import type { ResolvedSessionFields } from "../session/index.js";
import { readLastStdinSync } from "../state/stdin-cache.js";
import type { StdinPayload } from "../stdin/index.js";
import type { Theme } from "../theme/index.js";
import type { TokensSnapshot } from "../tokens/index.js";
import type { Cell } from "../widgets/cell.js";
import { realClock } from "../widgets/clock.js";
import { defaultRegistry, registerAllBuiltins } from "../widgets/index.js";
import { renderWidget, renderWidgetLabel } from "../widgets/render-widget.js";

/** Mode the preview was resolved in. Exposed for tests; consumers don't introspect it. */
export type PreviewMode =
  | {
      readonly kind: "real";
      readonly payload: StdinPayload;
      readonly session: ResolvedSessionFields;
      readonly tokens: TokensSnapshot;
      readonly git: GitState;
    }
  | { readonly kind: "label" };

export interface PreviewOptions {
  /** Resolved theme; defaults to `null` (uncoloured). */
  readonly theme?: Theme | null;
  /**
   * Env used for colour-depth + glyph detection. Defaults to `{}` so
   * tests stay deterministic; the editor passes `process.env` for
   * accurate colour resolution.
   */
  readonly env?: NodeJS.ProcessEnv;
  /**
   * Override `config.glyphs` for the preview without mutating the
   * loaded config. The editor passes its live mode here so toggling
   * `g` is visible immediately.
   */
  readonly glyphs?: AgentlineConfig["glyphs"];
}

let cachedMode: PreviewMode | undefined;

/**
 * Compute the preview mode from the cached last-stdin file. Sync, so
 * Ink can call `previewWidget` from a React render without async
 * plumbing. The TUI bundle is loaded only on `agentline edit`, so this
 * never touches the render path.
 *
 * `loadLiveSnapshots` (shared with `render/fixture-command.ts`) shells
 * out to `git` once; we accept that here (not the render path) so
 * widgets such as `git-branch` show the user's actual checkout instead
 * of a label.
 */
function computePreviewMode(env: NodeJS.ProcessEnv): PreviewMode {
  const cached = readLastStdinSync(env);
  if (!cached) return { kind: "label" };
  const { session, tokens, git } = loadLiveSnapshots(cached.payload, { env });
  return { kind: "real", payload: cached.payload, session, tokens, git };
}

/**
 * Resolve the preview mode for this process. Memoised — subsequent
 * calls reuse the first computed value so the editor doesn't reshell
 * `git` per keystroke.
 */
export function getPreviewMode(env: NodeJS.ProcessEnv = process.env): PreviewMode {
  if (cachedMode === undefined) cachedMode = computePreviewMode(env);
  return cachedMode;
}

/** Test seam — clear the memoised mode so the next call recomputes. */
export function resetPreviewModeCache(): void {
  cachedMode = undefined;
}

/** Test seam — pin a mode without consulting the cache file. */
export function setPreviewModeForTesting(mode: PreviewMode): void {
  cachedMode = mode;
}

function builtinRegistry(): ReturnType<typeof defaultRegistry> {
  const registry = defaultRegistry();
  if (registry.size() === 0) registerAllBuiltins(registry);
  return registry;
}

/**
 * Render one widget for the editor's preview / picker. Returns:
 *
 *   - the widget's `Cell` from the real render path when a cached
 *     stdin payload is available; or
 *   - a label-only `Cell` whose text is the widget's `type` when no
 *     cache exists.
 *
 * `hidden: true` widgets short-circuit either way.
 */
export function previewWidget(
  type: string,
  options?: Record<string, unknown>,
  opts: PreviewOptions = {},
): Cell {
  const config: WidgetConfig = options !== undefined ? { type, options } : { type };
  const mode = getPreviewMode(opts.env);
  if (mode.kind === "label") {
    return renderWidgetLabel(config, opts.glyphs ? { glyphs: opts.glyphs } : {});
  }
  const effectiveConfig: AgentlineConfig =
    opts.glyphs !== undefined ? { ...DEFAULT_CONFIG, glyphs: opts.glyphs } : DEFAULT_CONFIG;
  const ctx = buildWidgetContext({
    payload: mode.payload,
    config: effectiveConfig,
    theme: opts.theme ?? null,
    clock: realClock,
    env: opts.env ?? {},
    tokens: mode.tokens,
    git: mode.git,
    session: mode.session,
  });
  return renderWidget(builtinRegistry(), config, ctx);
}
