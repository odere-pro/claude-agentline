/**
 * `WidgetContext` — the inputs every widget reads from (§7.1).
 *
 * A widget's render is a pure function of `(ctx, settings)`. The
 * context bundles the parsed stdin payload, the merged config, the
 * resolved theme (or `null` when unconfigured), the clock, and the
 * env snapshot so widgets never reach into ambient state directly.
 * This makes goldens reproducible and lets unit tests inject any
 * subset they need.
 */

import type { AgentlineConfig } from "../config/types.js";
import type { GitState } from "../git/index.js";
import type { ResolvedSessionFields } from "../session/index.js";
import type { StdinPayload } from "../stdin/index.js";
import type { Theme } from "../theme/index.js";
import type { TokensSnapshot } from "../tokens/index.js";
import type { Clock } from "./clock.js";

export interface WidgetContext {
  readonly stdin: StdinPayload;
  readonly config: AgentlineConfig;
  readonly theme: Theme | null;
  readonly clock: Clock;
  readonly env: NodeJS.ProcessEnv;
  /**
   * Identity fields resolved from `stdin.user.*` with auth-file fallback
   * (§7.2.1). Resolved once per render tick by `loadSessionFields`;
   * widgets MUST NOT do filesystem I/O during `render()`.
   */
  readonly session?: ResolvedSessionFields;
  /**
   * Transcript-derived token / cost / context snapshot (§7.3, §7.4).
   * Resolved once per render tick by `loadTokensSnapshot`; widgets
   * MUST NOT read the JSONL transcript themselves during `render()`.
   */
  readonly tokens?: TokensSnapshot;
  /**
   * Git working-tree snapshot (§7.6). Resolved once per render tick
   * by `loadGitSnapshot`; widgets MUST NOT shell out to git from
   * `render()`. `available: false` means cwd was missing or not
   * inside a git repo and every git widget hides.
   */
  readonly git?: GitState;
}
