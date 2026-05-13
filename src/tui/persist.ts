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
import type { AgentlineConfig, GlyphMode, LineConfig } from "../config/types.js";

export interface SaveInput {
  readonly path: string;
  readonly base: AgentlineConfig;
  readonly lines: readonly LineConfig[];
  /**
   * When supplied, overrides `base.glyphs` so the editor's `g` toggle
   * lands on disk. Omit to preserve whatever the loaded config already
   * declared.
   */
  readonly glyphs?: GlyphMode;
}

export async function saveEditedConfig(input: SaveInput): Promise<AgentlineConfig> {
  const next: AgentlineConfig = {
    ...input.base,
    lines: trimTrailingEmpty(
      input.lines.map((line) => ({ widgets: line.widgets.map((w) => ({ ...w })) })),
    ),
    ...(input.glyphs !== undefined ? { glyphs: input.glyphs } : {}),
  };
  validateConfig(next);
  await atomicWriteJson(input.path, next);
  return next;
}

/**
 * The editor pads `state.lines` to a fixed `MAX_LINES` rows so navigation has
 * somewhere to go even on a single-line config. Don't write those padded
 * tails to disk — keep at least one row so the schema's `minItems` holds.
 */
function trimTrailingEmpty(lines: readonly LineConfig[]): LineConfig[] {
  const out = lines.map((l) => ({ widgets: l.widgets.map((w) => ({ ...w })) }));
  while (out.length > 1 && (out[out.length - 1]?.widgets.length ?? 0) === 0) {
    out.pop();
  }
  return out;
}
