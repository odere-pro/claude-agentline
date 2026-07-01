/**
 * Shared `WidgetContext` + live-snapshot assembly.
 *
 * Three call sites used to assemble these shapes independently:
 *
 *   - `render/pipeline.ts` builds a `WidgetContext` from `RenderInputs`
 *     and passes it to every widget's `render(ctx, …)`.
 *   - `render/fixture-command.ts#loadLiveSnapshots` assembles
 *     `{ session, tokens, git }` from a parsed stdin payload so the
 *     `agentline render` no-args path can hydrate the live snapshot
 *     channel.
 *   - `tui/preview-fixture.ts#computePreviewMode` assembles the same
 *     `{ session, tokens, git }` triple from the cached `last-stdin.json`
 *     payload so the editor's preview shows real values.
 *
 * Centralising both helpers here keeps the snapshot loader argument
 * shapes in lock-step — a future change to e.g. `loadGitSnapshot`'s
 * options surface lands once.
 */

import { loadGitSnapshot, type GitState } from "../../data/git/snapshot/snapshot.js";
import { readGitSnapshotSync } from "../../data/state/git-snapshot-cache/git-snapshot-cache.js";
import { createTranslator } from "../../core/i18n/index.js";
import { loadSessionFields, type ResolvedSessionFields } from "../../data/session/index.js";
import { loadPlanSnapshot, type PlanSnapshot } from "../../data/session/plan/plan.js";
import type { StdinPayload } from "../../core/stdin/index.js";
import { loadTokensSnapshot, type TokensSnapshot } from "../../data/tokens/index.js";
import type { Clock } from "../../widgets/clock/clock.js";
import type { WidgetContext } from "../../widgets/types.js";
import type { AgentlineConfig } from "../../data/config/types.js";

import type { RenderInputs } from "./inputs.js";

export interface LiveSnapshots {
  readonly session: ResolvedSessionFields;
  readonly tokens: TokensSnapshot;
  readonly git: GitState;
  /** Omitted when there is no active plan (keeps the bag key-absent). */
  readonly plan?: PlanSnapshot;
}

export interface LoadLiveSnapshotsOptions {
  readonly env?: NodeJS.ProcessEnv;
  /** Override `Date.now()` for deterministic tokens-snapshot windows. */
  readonly now?: number;
  /**
   * Resolved config for the current render tick. When provided, the
   * loader scans the widget list: if ANY `git-pr` widget has
   * `options.allowNetwork === true`, `loadGitSnapshot` is called with
   * `allowPullRequest: true` so `ctx.git.pr` is populated.
   *
   * When absent (e.g. the fixture / golden paths that don't carry a live
   * config) the loader defaults to no PR lookup — gate-14 stays green.
   */
  readonly config?: AgentlineConfig;
}

/**
 * Return `true` when the config contains at least one `git-pr` widget
 * whose `options.allowNetwork` is explicitly `true`. This is the
 * in-band signal that the user has accepted the latency / privacy cost
 * of running `gh pr view` on every render tick.
 *
 * Any other shape (no config, no `git-pr`, `allowNetwork` absent or
 * falsy) returns `false` and keeps the render hot path network-free
 * (gate-14).
 */
function hasAllowNetworkGitPr(config: AgentlineConfig | undefined): boolean {
  if (!config) return false;
  for (const line of config.lines) {
    for (const widget of line.widgets) {
      if (
        widget.type === "git-pr" &&
        widget.options != null &&
        widget.options["allowNetwork"] === true
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Load `{ session, tokens, git }` from a parsed stdin payload. All
 * three loaders are sync (`loadGitSnapshot` shells out to `git`); the
 * function stays sync overall so editor renders can call it from a
 * React tree without async plumbing.
 */
export function loadLiveSnapshots(
  payload: StdinPayload,
  options: LoadLiveSnapshotsOptions = {},
): LiveSnapshots {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  const session = loadSessionFields(payload, { env });
  const tokens = loadTokensSnapshot({
    transcriptPath: payload.transcriptPath,
    modelId: payload.model,
    now,
  });
  const allowPullRequest = hasAllowNetworkGitPr(options.config);
  /*
   * Host-first PR bridge: when the host supplies a usable PR (finite int > 0
   * and non-empty url), pass it to the snapshot loader so it can skip the
   * `gh` shell-out. "Usable" mirrors the same guards the loader applies.
   */
  const hostPrNum = payload.pr?.number;
  const hostPrUrl = payload.pr?.url;
  const hostPrUsable =
    typeof hostPrNum === "number" &&
    Number.isFinite(hostPrNum) &&
    Math.floor(hostPrNum) === hostPrNum &&
    hostPrNum > 0 &&
    typeof hostPrUrl === "string" &&
    hostPrUrl !== "";
  /*
   * Host-first worktree bridge: when the host names the worktree, pass it to
   * the snapshot loader so it can skip the `rev-parse --git-dir --show-toplevel`
   * spawn. "Usable" mirrors the loader's non-empty-string guard.
   */
  const hostWorktreeName = payload.worktree?.name;
  const hostWorktreeUsable = typeof hostWorktreeName === "string" && hostWorktreeName !== "";
  /*
   * Last-known-good fallback (anti-flicker): read the prior tick's git
   * snapshot for this cwd and hand it to the loader. When a `git` call
   * fails transiently, the loader reuses the cached field instead of
   * blanking it. Best-effort — a missing/corrupt cache reads back as null
   * and the loader behaves exactly as it did before. Live path only;
   * fixtures/goldens inject snapshots and never reach here.
   */
  const previousGit = payload.cwd ? readGitSnapshotSync(payload.cwd, env) : null;
  const git = loadGitSnapshot({
    cwd: payload.cwd,
    env,
    ...(allowPullRequest ? { allowPullRequest } : {}),
    ...(previousGit ? { previous: previousGit } : {}),
    ...(hostPrUsable && hostPrNum !== undefined && hostPrUrl !== undefined
      ? { hostPr: { number: hostPrNum, url: hostPrUrl } }
      : {}),
    ...(hostWorktreeUsable && hostWorktreeName !== undefined
      ? { hostWorktree: { name: hostWorktreeName } }
      : {}),
  });
  /*
   * Plan resolves per session from the same transcript the token snapshot
   * just read (cached this tick — no extra read). Order matters: tokens
   * before plan so the shared transcript cache is already warm.
   */
  const plan = loadPlanSnapshot({
    env,
    now,
    ...(payload.sessionId !== undefined ? { sessionId: payload.sessionId } : {}),
    ...(payload.transcriptPath !== undefined ? { transcriptPath: payload.transcriptPath } : {}),
  });
  return { session, tokens, git, ...(plan !== null ? { plan } : {}) };
}

export interface BuildWidgetContextInput extends Pick<
  RenderInputs,
  "config" | "theme" | "tokens" | "git" | "session" | "plan"
> {
  readonly payload: StdinPayload;
  readonly clock: Clock;
  readonly env: NodeJS.ProcessEnv;
}

/**
 * Build a `WidgetContext` from already-resolved inputs. Optional
 * snapshot fields are spread conditionally so `undefined` doesn't
 * appear on the returned object — widgets that need them probe via
 * `if (ctx.git?.available)` and the absence of the key is the
 * canonical "snapshot not loaded" signal.
 */
export function buildWidgetContext(input: BuildWidgetContextInput): WidgetContext {
  return {
    stdin: input.payload,
    config: input.config,
    theme: input.theme,
    clock: input.clock,
    env: input.env,
    t: createTranslator(input.config),
    ...(input.tokens !== undefined ? { tokens: input.tokens } : {}),
    ...(input.git !== undefined ? { git: input.git } : {}),
    ...(input.session !== undefined ? { session: input.session } : {}),
    ...(input.plan !== undefined ? { plan: input.plan } : {}),
  };
}
