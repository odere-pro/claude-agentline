/**
 * Two-line keybinding footer for the TUI editor.
 *
 * Renders motion bindings on the first line and action verbs on the
 * second so the user can scan the most relevant verbs quickly without
 * the motion noise. `footerLines` is the pure projection — the Ink
 * layout (`<Box flexDirection="column">…`) lives in `app.tsx`.
 */

import type { KeyBinding, KeyScope } from "../keys/index.js";

import { isPickerMode, type EditorMode } from "./state.js";

/** Short labels for the two-line footer. Falls back to the binding's description. */
const FOOTER_LABEL: Record<string, string> = {
  "move-cursor": "move",
  "move-cursor-row": "row",
  "move-widget": "move widget",
  "move-widget-row": "widget→row",
  "edit-widget": "+add",
  add: "add",
  replace: "replace",
  delete: "delete",
  save: "save",
  "toggle-glyphs": "glyphs on/off",
  "picker-filter": "type to filter",
  "picker-navigate": "navigate",
  "picker-confirm": "confirm",
  "picker-back": "back",
  quit: "quit",
};

/** Actions that describe navigation / motion — surfaced on the footer's first line. */
const MOTION_ACTIONS: ReadonlySet<string> = new Set([
  "move-cursor",
  "move-cursor-row",
  "move-widget",
  "move-widget-row",
  "picker-navigate",
]);

/** Map the reducer's mode (which includes the three picker steps) onto the
 *  display scope used by the footer. */
function modeToScope(mode: EditorMode): KeyScope {
  if (isPickerMode(mode)) return "picker";
  return "edit";
}

/** Footer split into a navigation/motion row and an actions row. */
export function footerLines(
  bindings: readonly KeyBinding[],
  mode: EditorMode,
): { readonly motion: string; readonly actions: string } {
  const scope = modeToScope(mode);
  const inScope = bindings.filter((b) => b.scope === scope || b.scope === "any");
  const fmt = (b: KeyBinding) => `${b.key} ${FOOTER_LABEL[b.action] ?? b.description}`;
  /*
   * Motion bindings come from the current scope only — `any`-scope bindings
   * (quit, help) belong on the actions line so they sit beside the verbs.
   */
  const motion = inScope.filter((b) => b.scope !== "any" && MOTION_ACTIONS.has(b.action));
  const actions = inScope.filter((b) => b.scope === "any" || !MOTION_ACTIONS.has(b.action));
  return {
    motion: motion.map(fmt).join(" · "),
    actions: actions.map(fmt).join(" · "),
  };
}
