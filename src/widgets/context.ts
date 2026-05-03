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
import type { StdinPayload } from "../stdin/index.js";
import type { Theme } from "../theme/index.js";
import type { Clock } from "./clock.js";

export interface WidgetContext {
  readonly stdin: StdinPayload;
  readonly config: AgentlineConfig;
  readonly theme: Theme | null;
  readonly clock: Clock;
  readonly env: NodeJS.ProcessEnv;
}
