/**
 * Persistence helper for `agentline config` (§4.9, §1.1 F10).
 *
 * Builds a complete `AgentlineConfig` from the editor's mutable line
 * list (everything else is preserved from the loaded config) and
 * writes it via `backupAndWriteConfig` (the shared config-backup +
 * atomic-write seam). Validation runs before disk write so a broken edit
 * never lands; the prior config is backed up to `<config>.bak` first so
 * `agentline config undo` can roll back a TUI save.
 */

import { backupAndWriteConfig } from "../../../data/config/backup/backup.js";
import { validateConfig } from "../../../data/config/validate/validate.js";
import type { AgentlineConfig, LineConfig } from "../../../data/config/types.js";
import { readLastStdinSync } from "../../../data/state/stdin-cache/stdin-cache.js";
import { saveLastRender } from "../../../data/state/render-cache/render-cache.js";
import { renderForFixture } from "../../../render/render/fixture/fixture-runner.js";
import { loadLiveSnapshots } from "../../../render/render/context.js";

export interface SaveInput {
  readonly path: string;
  readonly base: AgentlineConfig;
  readonly lines: readonly LineConfig[];
}

export async function saveEditedConfig(input: SaveInput): Promise<AgentlineConfig> {
  const next: AgentlineConfig = {
    ...input.base,
    lines: trimTrailingEmpty(
      input.lines.map((line) => ({ widgets: line.widgets.map((w) => ({ ...w })) })),
    ),
  };
  validateConfig(next);
  // Back up the prior config to `<config>.bak` before the edit lands, so
  // `agentline config undo` can roll back a TUI save.
  await backupAndWriteConfig(input.path, next);
  return next;
}

/**
 * Fire-and-forget render pass that refreshes `last-render.json` using the
 * most recently cached stdin payload and the freshly saved config. Called
 * after a successful `saveEditedConfig` so the cached render stays in sync
 * with the new config without waiting for the next Claude Code prompt.
 *
 * Best-effort: any failure is swallowed so the save result is unaffected.
 */
export async function triggerBackgroundRerender(
  savedConfig: AgentlineConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  try {
    const cached = readLastStdinSync(env);
    if (!cached) return;
    const snapshots = loadLiveSnapshots(cached.payload, { env });
    const rendered = await renderForFixture(JSON.stringify(cached.payload), {
      config: savedConfig,
      git: snapshots.git,
      tokens: snapshots.tokens,
      session: snapshots.session,
      env,
    });
    await saveLastRender(rendered, { env });
  } catch {
    // best-effort
  }
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
