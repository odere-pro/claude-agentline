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
 * Add / replace share a three-step picker drill-down owned by
 * `use-editor-input.ts`:
 *
 *   step 1 (`picker-group`)   — empty search ⇒ pick a family;
 *                                typing flips the view to a flat global
 *                                widget list filtered by substring (across
 *                                every family at once). Picking a result
 *                                from the flat view skips step 2.
 *   step 2 (`picker-widget`)  — pick a widget within the chosen family.
 *   step 3 (`picker-variant`) — pick a variant (skipped for widgets that
 *                                have none in the catalogue).
 */

import { projectGate } from "../lib/claude-project.js";
import { resolveEnv } from "../lib/env.js";
import { maybeRefresh } from "../update-check/index.js";
import { resolveConfiguredTheme } from "../theme/resolve.js";

import type { RunConfigInput, RunConfigResult } from "./app.js";
import { pickGlyphs } from "./glyphs.js";
import { mountEditor, resolveStartingConfig } from "./mount.js";

export type { RunConfigInput, RunConfigResult } from "./app.js";

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
  });
  await waitUntilExit;
  unmount();
  return { saved: savedRef.value, path };
}

export default runConfigCommand;
