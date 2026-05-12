/**
 * Default keymap registry (§5.5).
 *
 * Each binding declares the visible key, its action id (used by the TUI
 * dispatcher), the scope it applies in, and a human-readable description.
 * The registry is the single source of truth: the TUI footer reads from
 * here, `agentline config keys [--json]` enumerates from here, and gate-17
 * (keymap coverage) verifies that every §5.5 row is represented.
 *
 * Scopes mirror the editor's modes — `edit` is the layout view; `picker`
 * and `options` belong to the overlay components and are added as those
 * land. `any` applies regardless of mode.
 */

export type KeyScope = "edit" | "picker" | "options" | "any";

export interface KeyBinding {
  readonly key: string;
  readonly action: string;
  readonly scope: KeyScope;
  readonly description: string;
}

export const DEFAULT_KEY_BINDINGS: readonly KeyBinding[] = Object.freeze([
  { key: "← →", action: "move-cursor", scope: "edit", description: "move the selection within the row" },
  { key: "↑ ↓", action: "move-cursor-row", scope: "edit", description: "move the selection to the adjacent row" },
  { key: "⇧← ⇧→", action: "move-widget", scope: "edit", description: "move the selected widget within its row" },
  { key: "⇧↑ ⇧↓", action: "move-widget-row", scope: "edit", description: "move the selected widget to the adjacent row" },
  { key: "a", action: "add", scope: "edit", description: "add a widget" },
  { key: "r", action: "replace", scope: "edit", description: "replace the selected widget" },
  { key: "x", action: "delete", scope: "edit", description: "delete the selected widget" },
  { key: "v", action: "toggle-visible", scope: "edit", description: "show / hide the selected widget" },
  { key: "m", action: "cycle-spacing", scope: "edit", description: "spacing to neighbour: full / single space / none" },
  { key: "l", action: "toggle-label", scope: "edit", description: "show / hide the widget's own label" },
  { key: "S", action: "save", scope: "edit", description: "save" },
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
