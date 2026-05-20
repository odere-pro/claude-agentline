/**
 * Ink-based TUI editor entry (`agentline edit` — §1.1 F10, §5.5).
 *
 * Loaded ONLY by a dynamic `import("./tui.mjs")` from cli.mjs; tsup
 * builds it as a separate output file so Ink + React never appear in
 * the render-path bundle (§1.2 N3).
 *
 * This module is the thin entry layer: gate the project, resolve the
 * starting config, hand off to `mountEditor`. Everything else has its
 * own file:
 *
 *   - `app.ts`              — the Ink `App` component + JSX tree
 *   - `use-editor-input.ts` — keypress handlers + per-step transient state
 *   - `mount.ts`            — render lifecycle, alt-screen + signal
 *                              wiring, config resolution helpers
 *   - `footer.ts`           — the two-line keybinding footer
 *
 * Add / replace share a picker drill-down owned by
 * `use-editor-input.ts` with four picker modes:
 *
 *   step 1a (`picker-group`)   — the default view: family browser.
 *                                 `/` switches to `picker-search`.
 *   step 1b (`picker-widget`)  — in-family widget list with a live
 *                                 filter.
 *   step 1c (`picker-search`)  — flat, searchable list across every
 *                                 catalogued widget; family badges on
 *                                 each row, already-placed widgets
 *                                 hidden.
 *   step 2  (`picker-variant`) — pick a variant (skipped for widgets
 *                                 that have none in the catalogue).
 */

import { projectGate } from "../../../core/lib/claude-project/claude-project.js";
import { resolveEnv } from "../../../core/lib/env/env.js";
import { maybeRefresh } from "../../../commands/update-check/index.js";
import { resolveConfiguredTheme } from "../../../data/theme/resolve/resolve.js";

import type { RunConfigInput, RunConfigResult } from "../app.js";
import { pickGlyphs } from "../glyphs/glyphs.js";
import { mountEditor, resolveStartingConfig } from "../mount.js";

export type { RunConfigInput, RunConfigResult } from "../app.js";

export async function runConfigCommand(input: RunConfigInput = {}): Promise<RunConfigResult> {
  const gate = await projectGate({
    command: "edit",
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
    ...(input.stdin !== undefined ? { stdin: input.stdin } : {}),
  });
  if (gate === "skip") return { saved: false, path: "", skipped: true };
  /*
   * Fire-and-forget npm-registry probe so the cache that `agentline
   * doctor` reads is reasonably fresh after every editor session.
   * Wrapped in a swallowed `.catch` for belt-and-braces — `maybeRefresh`
   * already never throws, but a bare `void` would let a runtime
   * surprise (e.g. unhandled rejection in a test seam) bubble.
   */
  void maybeRefresh().catch(() => undefined);
  const { config, path } = await resolveStartingConfig(input);
  const env = resolveEnv(input);
  const previewTheme = await resolveConfiguredTheme(config.theme, { env });
  const glyphs = pickGlyphs({ env });
  const { waitUntilExit, unmount, savedRef } = mountEditor({
    config,
    path,
    previewTheme,
    glyphs,
    env,
  });
  await waitUntilExit;
  unmount();
  return { saved: savedRef.value, path };
}

export default runConfigCommand;
