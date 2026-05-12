/**
 * Synthetic, pure render fixture (editor-redesign plan, step 5).
 *
 * A frozen "representative session" — no filesystem or network I/O — rich
 * enough that every widget family renders a meaningful value. It feeds:
 *   - the TUI editor's live preview (`previewStatusline`);
 *   - the picker's per-widget mini-preview and `agentline config widget
 *     catalog --preview` (`previewWidget`).
 *
 * Every value here is a literal; nothing is read from the host. The clock
 * is frozen so previews are byte-stable for a given config.
 */

import { DEFAULT_CONFIG } from "../config/defaults.js";
import type { AgentlineConfig } from "../config/types.js";
import type { GitState } from "../git/index.js";
import type { ResolvedSessionFields } from "../session/index.js";
import type { StdinPayload } from "../stdin/index.js";
import type { Theme } from "../theme/index.js";
import { contextWindowFor, PRICING_TABLE_VERSION, type TokensSnapshot } from "../tokens/index.js";
import type { Cell } from "../widgets/cell.js";
import type { WidgetContext } from "../widgets/context.js";
import { frozenClock, type Clock } from "../widgets/clock.js";
import { defaultRegistry, registerAllBuiltins } from "../widgets/index.js";
import { renderWidget } from "../widgets/render-widget.js";
import { renderFromInputs, type RenderInputs } from "./pipeline.js";

/** Wall-clock the demo is frozen at (UTC). */
export const DEMO_CLOCK_ISO = "2026-05-12T14:30:00.000Z";
const DEMO_NOW = Date.parse(DEMO_CLOCK_ISO);
const MINUTE = 60_000;
const DEMO_MODEL = "claude-opus-4-7";
const DEMO_CWD = "/agentline";

/** Frozen clock for the demo context. */
export function demoClock(): Clock {
  return frozenClock(DEMO_CLOCK_ISO);
}

/** The parsed-stdin half of the demo session. */
export const demoStdinPayload: StdinPayload = Object.freeze({
  raw: {},
  truncated: false,
  model: DEMO_MODEL,
  version: "2.0.14",
  outputStyle: "default",
  sessionId: "demo1234abcd",
  sessionName: "demo",
  cwd: DEMO_CWD,
  thinkingEffort: "high",
  vimMode: "INSERT",
});

/** Identity fields the session widgets read from `ctx.session`. */
export const demoSession: ResolvedSessionFields = Object.freeze({
  model: DEMO_MODEL,
  version: "2.0.14",
  outputStyle: "default",
  sessionId: "demo1234abcd",
  sessionName: "demo",
  accountEmail: "you@example.com",
  loginMethod: "oauth",
  orgSlug: "agentline",
  thinkingEffort: "high",
  vimMode: "INSERT",
  skills: Object.freeze(["agentline-configure", "agentline-themes"]) as readonly string[],
});

/** Transcript-derived token / cost / context snapshot for the demo. */
export const demoTokens: TokensSnapshot = Object.freeze({
  events: Object.freeze([
    {
      timestamp: DEMO_NOW - 30 * MINUTE,
      model: DEMO_MODEL,
      effort: "high",
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      compaction: true,
    },
    {
      timestamp: DEMO_NOW,
      model: DEMO_MODEL,
      effort: "high",
      inputTokens: 12_345,
      outputTokens: 6_789,
      cachedTokens: 4_321,
      compaction: false,
    },
  ]) as TokensSnapshot["events"],
  now: DEMO_NOW,
  sessionStart: DEMO_NOW - 120 * MINUTE,
  blockAnchor: DEMO_NOW - 90 * MINUTE,
  contextWindow: contextWindowFor(DEMO_MODEL),
  pricingVersion: PRICING_TABLE_VERSION,
});

/** Git working-tree snapshot for the demo (a dirty checkout one commit ahead of `origin/main`). */
export const demoGit: GitState = Object.freeze({
  available: true,
  cwd: DEMO_CWD,
  branch: "main",
  detached: false,
  sha: "a1b2c3def4567890abcdef1234567890abcdef12",
  shortSha: "a1b2c3d",
  status: Object.freeze({ staged: 2, unstaged: 1, untracked: 0, conflicts: 0, modified: 1, added: 1 }),
  diff: Object.freeze({ insertions: 12, deletions: 3, filesChanged: 2 }),
  diffStaged: Object.freeze({ insertions: 8, deletions: 1, filesChanged: 1 }),
  aheadBehind: Object.freeze({ ahead: 1, behind: 0 }),
  upstream: "origin/main",
  origin: Object.freeze({ owner: "agentline", repo: "agentline" }),
  upstreamRemote: null,
  worktreeName: null,
  inWorktree: false,
});

export interface DemoOptions {
  /** Resolved theme to colour the preview with; defaults to `null` (uncoloured). */
  readonly theme?: Theme | null;
  /** Terminal width for line composition; defaults to a roomy 120. */
  readonly width?: number;
}

/** Assemble `RenderInputs` for the demo session against a caller-supplied config. */
export function demoRenderInputs(config: AgentlineConfig, opts: DemoOptions = {}): RenderInputs {
  return {
    payload: demoStdinPayload,
    config,
    theme: opts.theme ?? null,
    clock: demoClock(),
    env: {},
    width: opts.width ?? 120,
    flags: { noColor: false, noUnicode: false },
    tokens: demoTokens,
    git: demoGit,
  };
}

/** Render a full statusline from `config` against the demo session — what the editor's live preview shows. */
export function previewStatusline(config: AgentlineConfig, opts: DemoOptions = {}): string {
  return renderFromInputs(demoRenderInputs(config, opts));
}

/** Build the demo `WidgetContext` directly, for previewing a single widget out of line context. */
export function demoContext(opts: DemoOptions = {}): WidgetContext {
  return {
    stdin: demoStdinPayload,
    config: DEFAULT_CONFIG,
    theme: opts.theme ?? null,
    clock: demoClock(),
    env: {},
    session: demoSession,
    tokens: demoTokens,
    git: demoGit,
  };
}

function builtinRegistry(): ReturnType<typeof defaultRegistry> {
  const registry = defaultRegistry();
  if (registry.size() === 0) registerAllBuiltins(registry);
  return registry;
}

/**
 * Render one widget by `type` against the demo session, returning its `Cell`.
 * Unknown types yield `HIDDEN_CELL` (via `renderWidget`'s non-strict path).
 */
export function previewWidget(
  type: string,
  options?: Record<string, unknown>,
  demoOpts: DemoOptions = {},
): Cell {
  return renderWidget(
    builtinRegistry(),
    options !== undefined ? { type, options } : { type },
    demoContext(demoOpts),
  );
}
