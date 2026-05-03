/**
 * Persistence helper for `agentline config` (§4.9, §1.1 F10).
 *
 * Builds a complete `AgentlineConfig` from the editor's mutable line
 * list (everything else is preserved from the loaded config) and
 * writes it via the existing atomic-write helper. Validation runs
 * before disk write so a broken edit never lands.
 */

import { atomicWriteJson } from "../config/atomic.js";
import { validateConfig } from "../config/validate.js";
import type { AgentlineConfig, LineConfig } from "../config/types.js";

export interface SaveInput {
  readonly path: string;
  readonly base: AgentlineConfig;
  readonly lines: readonly LineConfig[];
}

export async function saveEditedConfig(input: SaveInput): Promise<AgentlineConfig> {
  const next: AgentlineConfig = {
    ...input.base,
    lines: input.lines.map((line) => ({
      widgets: line.widgets.map((w) => ({ ...w })),
    })),
  };
  validateConfig(next);
  await atomicWriteJson(input.path, next);
  return next;
}
