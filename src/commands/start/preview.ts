/**
 * One-shot statusline preview for `agentline start`.
 *
 * Runs the *current* render code against the user's *existing* config so
 * that, right after a (re)install + rewire, the user can confirm the new
 * version renders with the configuration they already have.
 *
 * There is no live Claude Code stdin payload at `start` time, so a small
 * representative payload is synthesised. `cwd` is the directory the user
 * ran `start` from, which lets the git widgets reflect their real repo.
 * Snapshots that need a transcript (tokens, session, plan) are absent —
 * the dependent widgets hide. The preview is therefore a layout/colour
 * confirmation, not a byte-for-byte copy of the live bar.
 *
 * Stays on the render path (core → data → render) and never imports the
 * TUI island (gate-19). Any failure resolves to `undefined`: the wiring
 * has already succeeded, so a broken preview must not fail the command.
 */

import { Readable } from "node:stream";

import { readStdinPayload } from "../../core/stdin/index.js";
import { loadConfig } from "../../data/config/load/load.js";
import type { AgentlineConfig } from "../../data/config/types.js";
import { loadLiveSnapshots } from "../../render/render/context.js";
import { renderForFixture } from "../../render/render/fixture/fixture-runner.js";

export interface RenderStartPreviewDeps {
  /** Loads the merged user config. Injected in tests; defaults to `loadConfig`. */
  readonly load?: () => Promise<{ readonly config: AgentlineConfig }>;
  /** Render entry. Injected in tests; defaults to `renderForFixture`. */
  readonly render?: typeof renderForFixture;
  /** Working directory used in the synthetic payload. Defaults to `process.cwd()`. */
  readonly cwd?: string;
}

/**
 * Build the synthetic Claude Code statusline payload used for the
 * preview. Mirrors the field names of the real stdin contract (see
 * `src/core/stdin/index.ts`) so the same adapter path runs.
 */
function buildPreviewPayload(cwd: string): string {
  return JSON.stringify({
    model: { id: "claude-opus-4-8", display_name: "Opus 4.8" },
    version: "0.0.0",
    output_style: { name: "default" },
    session_id: "agentline-start-preview",
    workspace: { current_dir: cwd, project_dir: cwd },
    cwd,
  });
}

/**
 * Render a single preview line, or `undefined` when the config cannot be
 * loaded or the render throws. Never rejects.
 */
export async function renderStartPreview(deps: RenderStartPreviewDeps = {}): Promise<
  string | undefined
> {
  const load = deps.load ?? loadConfig;
  const render = deps.render ?? renderForFixture;
  const cwd = deps.cwd ?? process.cwd();

  let config: AgentlineConfig;
  try {
    config = (await load()).config;
  } catch {
    return undefined;
  }

  const payload = buildPreviewPayload(cwd);
  try {
    const parsed = await readStdinPayload(Readable.from([Buffer.from(payload, "utf8")]));
    const snapshots = loadLiveSnapshots(parsed, { config });
    return await render(payload, { config, ...snapshots });
  } catch {
    return undefined;
  }
}
