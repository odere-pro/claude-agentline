/**
 * Preview data resolution for `agentline edit`.
 *
 * The editor preview is always a *data view* — never a bare type-name
 * placeholder. Data is resolved in a strict waterfall, decided at first
 * use:
 *
 *   - **cache**      — a recent `last-stdin.json` exists. Rebuild the
 *                      exact `WidgetContext` the live render would see
 *                      (stdin payload + resolved session/tokens/git).
 *
 *   - **discovered** — no cache, but a Claude Code data directory exists.
 *                      Find the newest transcript under
 *                      `${CLAUDE_CONFIG_DIR:-~/.claude}/projects/` and
 *                      synthesize a payload from it (real token counts,
 *                      real git via its cwd, real identity via the
 *                      `auth.json` fallback in `loadSessionFields`).
 *
 *   - **mock**       — nothing real to read. A representative literal
 *                      session so every widget family still renders a
 *                      plausible value (`preview-mock.ts`).
 *
 * Per-widget self-hide (no data for *this* widget even with real
 * context) still degrades to a dim family-glyph + type-name chip — the
 * caller (`renderSlot`) dims it. That is the only place a type name
 * surfaces, and only as identity, never as the whole preview.
 *
 * The mode is computed once per render tick and cached on a module-level
 * field. `resetPreviewModeCache()` exposes that cache to tests; the TUI
 * editor itself never touches it. Every loader here uses sync I/O, so
 * this stays compatible with the synchronous `previewWidget` call that
 * Ink renders perform from React.
 */

import { DEFAULT_CONFIG } from "../config/defaults.js";
import type { AgentlineConfig, WidgetConfig } from "../config/types.js";
import type { GitState } from "../git/index.js";
import { buildWidgetContext, loadLiveSnapshots } from "../render/context.js";
import { loadSessionFields, type ResolvedSessionFields } from "../session/index.js";
import { loadPlanSnapshot, type PlanSnapshot } from "../session/plan.js";
import { readLastStdinSync } from "../state/stdin-cache.js";
import type { StdinPayload } from "../stdin/index.js";
import type { Theme } from "../theme/index.js";
import { loadTokensSnapshot, type TokensSnapshot } from "../tokens/index.js";
import type { Cell } from "../widgets/cell.js";
import { realClock } from "../widgets/clock.js";
import { defaultRegistry, registerAllBuiltins } from "../widgets/index.js";
import { renderWidget, renderWidgetLabel, widgetIdentityFor } from "../widgets/render-widget.js";
import { discoverLatestTranscript } from "./preview-discovery.js";
import { buildMockPreview, MOCK_MODEL, MOCK_MODEL_LABEL } from "./preview-mock.js";

/**
 * Resolved preview data. A single shape — every tier produces real
 * widget context; `source` is informational (tests / future telemetry).
 */
export interface PreviewMode {
  readonly source: "cache" | "discovered" | "mock";
  readonly payload: StdinPayload;
  readonly session: ResolvedSessionFields;
  readonly tokens: TokensSnapshot;
  readonly git: GitState;
  /** Absent when there is no active plan (mock always supplies one). */
  readonly plan?: PlanSnapshot;
}

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
   * The user's resolved config. Drives family identity (glyph + accent
   * via `config.families`) and any per-widget cosmetic overrides, so the
   * preview resolves through the *same* inputs as the live statusline
   * (`renderFromInputs`). Defaults to `DEFAULT_CONFIG` when omitted —
   * keeps tests and any caller that only wants catalogue defaults honest.
   */
  readonly config?: AgentlineConfig;
}

/**
 * Git snapshots cached by cwd. The shell-out is expensive; branch/worktree
 * state is stable for the duration of an editor session. Everything else
 * (session fields, token counts) is recomputed from the freshest
 * `last-stdin.json` on each call so the editor preview stays in sync with
 * the live statusline — e.g. a new Claude Code session that resets usage to
 * 0% is visible without closing and reopening the editor.
 */
const _gitCache = new Map<string, GitState>();

/**
 * Per-render deduplication cache. Multiple `previewWidget` calls within a
 * single Ink render pass share one mode so we don't reshell `git` or
 * re-read the stdin cache more than once per frame (~50 ms).
 */
let _cache: PreviewMode | undefined;
let _cacheMs = 0;
const RENDER_TICK_MS = 50;

/**
 * Test seam — when set, `getPreviewMode` returns this value unconditionally
 * instead of consulting the disk. Cleared by `resetPreviewModeCache`.
 */
let _testMode: PreviewMode | undefined;

/**
 * Build real widget context for a payload. Git is loaded once per cwd and
 * cached in `_gitCache`; session and token snapshots are always recomputed
 * so the editor reflects the freshest data — including usage resets — on
 * each render tick.
 */
function buildReal(
  payload: StdinPayload,
  source: "cache" | "discovered",
  env: NodeJS.ProcessEnv,
): PreviewMode {
  const cwd = payload.cwd ?? "";
  if (!_gitCache.has(cwd)) {
    /*
     * First time for this cwd: run git once and store the result.
     */
    const snap = loadLiveSnapshots(payload, { env });
    _gitCache.set(cwd, snap.git);
    return {
      source,
      payload,
      session: snap.session,
      tokens: snap.tokens,
      git: snap.git,
      ...(snap.plan !== undefined ? { plan: snap.plan } : {}),
    };
  }

  /*
   * Git already cached — recompute only the cheap parts (no shell-out).
   */
  const session = loadSessionFields(payload, { env });
  const tokens = loadTokensSnapshot({
    transcriptPath: payload.transcriptPath,
    modelId: payload.model,
    now: Date.now(),
  });
  const plan = loadPlanSnapshot({ env });
  return {
    source,
    payload,
    session,
    tokens,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    git: _gitCache.get(cwd)!,
    ...(plan !== null ? { plan } : {}),
  };
}

/**
 * Resolve preview data in a strict waterfall (sync, so Ink can call
 * `previewWidget` from a React render). Order: the cached stdin payload,
 * then a discovered Claude Code transcript, then the literal mock.
 */
function computePreviewMode(env: NodeJS.ProcessEnv): PreviewMode {
  const cached = readLastStdinSync(env);
  if (cached) return buildReal(cached.payload, "cache", env);

  const discovered = discoverLatestTranscript({ env });
  if (discovered) {
    /*
     * Claude Code transcripts carry no model id, so the token parser
     * can't recover one. Fall back to the mock model so the model widget
     * shows a plausible value rather than a dim stub.
     */
    const payload: StdinPayload =
      discovered.model !== undefined
        ? discovered
        : { ...discovered, model: MOCK_MODEL, modelDisplayName: MOCK_MODEL_LABEL };
    return buildReal(payload, "discovered", env);
  }

  return { source: "mock", ...buildMockPreview() };
}

/**
 * Resolve the preview mode for the current render pass.
 *
 * Results are deduplicated within a ~50 ms render window so multiple
 * `previewWidget` calls from the same Ink frame share one computation.
 * After the window expires the next call re-reads `last-stdin.json` so
 * the editor stays in sync with the running statusline.
 *
 * When `setPreviewModeForTesting` has been called, that pinned value is
 * returned unconditionally (no disk access).
 */
export function getPreviewMode(env: NodeJS.ProcessEnv = process.env): PreviewMode {
  if (_testMode !== undefined) return _testMode;
  const now = Date.now();
  if (_cache !== undefined && now - _cacheMs < RENDER_TICK_MS) return _cache;
  _cache = computePreviewMode(env);
  _cacheMs = now;
  return _cache;
}

/** Test seam — clear all caches so the next call recomputes from disk. */
export function resetPreviewModeCache(): void {
  _testMode = undefined;
  _cache = undefined;
  _cacheMs = 0;
  _gitCache.clear();
}

/** Test seam — pin a mode without consulting the cache file. */
export function setPreviewModeForTesting(mode: PreviewMode): void {
  _testMode = mode;
  /*
   * Clear the TTL cache so the pinned mode takes effect immediately.
   */
  _cache = undefined;
  _cacheMs = 0;
}

function builtinRegistry(): ReturnType<typeof defaultRegistry> {
  const registry = defaultRegistry();
  if (registry.size() === 0) registerAllBuiltins(registry);
  return registry;
}

/**
 * Render one widget for the editor's preview / picker against the
 * resolved preview data (cache / discovered / mock). When the widget
 * self-hides for *this* session it degrades to a dim family-glyph +
 * type-name identity chip rather than vanishing.
 */
export function previewWidget(
  type: string,
  options?: Record<string, unknown>,
  opts: PreviewOptions = {},
): Cell {
  const config: WidgetConfig = options !== undefined ? { type, options } : { type };
  const mode = getPreviewMode(opts.env);
  /*
   * Render through the caller's resolved config so family identity
   * (`config.families`) and per-widget overrides match what the live
   * statusline prints. Falls back to catalogue defaults when unset.
   */
  const effectiveConfig = opts.config ?? DEFAULT_CONFIG;
  const ctx = buildWidgetContext({
    payload: mode.payload,
    config: effectiveConfig,
    theme: opts.theme ?? null,
    clock: realClock,
    env: opts.env ?? {},
    tokens: mode.tokens,
    git: mode.git,
    session: mode.session,
    ...(mode.plan !== undefined ? { plan: mode.plan } : {}),
  });
  const cell = renderWidget(builtinRegistry(), config, ctx);
  /*
   * When the widget self-hides (no live data for this session), fall back
   * to a label cell that carries the family glyph and accent colour rather
   * than returning bare HIDDEN_CELL. The caller (renderSlot) dims the slot
   * via `hidden: true`, but the user still sees *which* widget is there and
   * which family it belongs to — matching the visual identity of what the
   * real statusline would show if the data were present.
   */
  if (cell.hidden || cell.text === "") {
    const identity = widgetIdentityFor(type, { env: opts.env ?? {}, config: effectiveConfig });
    const labelCell = renderWidgetLabel(config, identity);
    return Object.freeze({ ...labelCell, hidden: true });
  }
  return cell;
}
