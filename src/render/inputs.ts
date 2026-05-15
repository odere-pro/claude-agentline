/**
 * `RenderInputs` — the bag type the real render pipeline (`pipeline.ts`)
 * consumes. Lives in its own module so `pipeline.ts` doesn't have to
 * directly import every cross-module type the bag references; the
 * pipeline's own body only needs `Theme`, `Clock`, `Cell`, and
 * `Segment`. Snapshot types (`TokensSnapshot`, `GitState`,
 * `ResolvedSessionFields`) and the stdin payload appear only as field
 * types here, which keeps the pipeline's import surface focused on the
 * modules it actually mutates.
 */

import type { AgentlineConfig } from "../config/types.js";
import type { GitState } from "../git/index.js";
import type { ResolvedSessionFields } from "../session/index.js";
import type { StdinPayload } from "../stdin/index.js";
import type { Theme } from "../theme/index.js";
import type { TokensSnapshot } from "../tokens/index.js";
import type { Clock } from "../widgets/clock.js";

import type { AccessibilityFlags } from "./accessibility.js";

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
  readonly session?: ResolvedSessionFields;
}
