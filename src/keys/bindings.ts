/**
 * Default keymap registry (§5.5).
 *
 * Each binding declares the visible key, its action id (used by the TUI
 * dispatcher), the scope it applies in, and a human-readable description.
 * The registry is the single source of truth: the TUI footer / help overlay
 * read from here, `agentline config keys [--json]` enumerates from here, and
 * gate-17 (keymap coverage) verifies that every §5.5 action is represented.
 *
 * Scopes mirror the editor's modes: `edit` is the layout view, `picker` is
 * the widget chooser overlay, `options` is the per-widget options sheet, and
 * `any` applies regardless of mode.
 */

export type KeyScope = "edit" | "picker" | "options" | "any";

export interface KeyBinding {
  readonly key: string;
  readonly action: string;
  readonly scope: KeyScope;
  readonly description: string;
}

export const DEFAULT_KEY_BINDINGS: readonly KeyBinding[] = Object.freeze([
  // ── edit (the layout view) ───────────────────────────────────────────────
  { key: "← →", action: "move-cursor", scope: "edit", description: "move the selection within the row (incl. the trailing +add cell)" },
  { key: "↑ ↓", action: "move-cursor-row", scope: "edit", description: "move the selection between rows" },
  { key: "⇧← ⇧→", action: "move-widget", scope: "edit", description: "move the selected widget within its row" },
  { key: "⇧↑ ⇧↓", action: "move-widget-row", scope: "edit", description: "move the selected widget to the adjacent row" },
  { key: "↵", action: "edit-widget", scope: "edit", description: "+add cell → open the picker; on a widget → open the options sheet" },
  { key: "a", action: "add", scope: "edit", description: "add a widget (opens the picker)" },
  { key: "r", action: "replace", scope: "edit", description: "replace the selected widget (opens the picker)" },
  { key: "u", action: "update", scope: "edit", description: "update the selected widget — pick a different variant of the same widget" },
  { key: "d", action: "delete", scope: "edit", description: "delete the selected widget" },
  { key: "o", action: "options", scope: "edit", description: "open the selected widget's options sheet" },
  { key: "g", action: "toggle-glyphs", scope: "edit", description: "toggle Nerd Font glyphs on / off (top-level config.glyphs)" },
  { key: "S", action: "save", scope: "edit", description: "save (Ctrl+S also works)" },
  // ── picker (the three-step widget chooser overlay) ───────────────────────
  { key: "(type)", action: "picker-filter", scope: "picker", description: "type to filter widgets by name or type (step 2)" },
  { key: "↑ ↓", action: "picker-navigate", scope: "picker", description: "highlight a row" },
  { key: "↵", action: "picker-confirm", scope: "picker", description: "confirm the highlighted row and advance / commit" },
  { key: "Esc", action: "picker-back", scope: "picker", description: "step back one level (cancels at step 1)" },
  // ── options (the per-widget options sheet) ───────────────────────────────
  { key: "v", action: "toggle-visible", scope: "options", description: "show / hide the widget" },
  { key: "l", action: "toggle-label", scope: "options", description: "show / hide the widget's own label" },
  { key: "m", action: "cycle-spacing", scope: "options", description: "spacing to neighbour: full / single space / none" },
  { key: "Esc", action: "options-close", scope: "options", description: "close the options sheet" },
  // ── any mode ─────────────────────────────────────────────────────────────
  { key: "q", action: "quit", scope: "any", description: "quit (prompts if there are unsaved changes)" },
  { key: "?", action: "help", scope: "any", description: "toggle the help overlay" },
] as const) as readonly KeyBinding[];

export function listBindings(
  overrides: Record<string, string> | undefined = {},
): readonly KeyBinding[] {
  if (!overrides || Object.keys(overrides).length === 0) {
    return DEFAULT_KEY_BINDINGS;
  }
  return DEFAULT_KEY_BINDINGS.map((b) => {
    const override = overrides[b.action];
    return override ? { ...b, key: override } : b;
  });
}
