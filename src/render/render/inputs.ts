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

import type { AgentlineConfig } from "../../data/config/types.js";
import type { GitState } from "../../data/git/index.js";
import type { ResolvedSessionFields } from "../../data/session/index.js";
import type { PlanSnapshot } from "../../data/session/plan/plan.js";
import type { StdinPayload } from "../../core/stdin/index.js";
import type { Theme } from "../../data/theme/index.js";
import type { TokensSnapshot } from "../../data/tokens/index.js";
import type { Clock } from "../../widgets/clock/clock.js";

import type { AccessibilityFlags } from "./accessibility/accessibility.js";

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
  readonly plan?: PlanSnapshot;
}
