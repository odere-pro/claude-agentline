/**
 * Default keymap registry (§5.5).
 *
 * Each binding declares the visible key, its action id (used by the
 * TUI dispatcher), the scope it applies in, and a human-readable
 * description. The registry is the single source of truth: the TUI
 * footer reads from here, `agentline keys [--json]` enumerates from
 * here (PR 18), and gate-17 (keymap coverage) verifies that every
 * §5.5 row is represented.
 */

export type KeyScope =
  | "list"
  | "widget"
  | "git widgets"
  | "context widgets"
  | "separator"
  | "any";

export interface KeyBinding {
  readonly key: string;
  readonly action: string;
  readonly scope: KeyScope;
  readonly description: string;
}

export const DEFAULT_KEY_BINDINGS: readonly KeyBinding[] = Object.freeze([
  { key: "↑ ↓", action: "navigate", scope: "list", description: "navigate" },
  { key: "← →", action: "change-type", scope: "widget", description: "change type" },
  { key: "a", action: "add", scope: "list", description: "add widget" },
  { key: "d", action: "delete", scope: "widget", description: "delete" },
  { key: "r", action: "toggle-raw", scope: "widget", description: "toggle raw value" },
  { key: "m", action: "cycle-merge", scope: "widget", description: "cycle merge mode" },
  { key: "h", action: "toggle-hidden", scope: "widget", description: "toggle hidden" },
  {
    key: "l",
    action: "toggle-link",
    scope: "git widgets",
    description: "toggle clickable IDE link (VS Code / Cursor / IntelliJ)",
  },
  { key: "t", action: "toggle-title", scope: "widget", description: "toggle title/label" },
  { key: "p", action: "cycle-display", scope: "widget", description: "cycle display variant" },
  { key: "s", action: "toggle-compact", scope: "widget", description: "toggle compact / short" },
  { key: "v", action: "cycle-inversion", scope: "widget", description: "invert / cycle inversion" },
  { key: "e", action: "edit-inline", scope: "widget", description: "edit inline value" },
  {
    key: "u",
    action: "toggle-used-remaining",
    scope: "context widgets",
    description: "toggle used-vs-remaining",
  },
  { key: "f", action: "cycle-format", scope: "widget", description: "cycle format" },
  { key: "n", action: "toggle-nerd", scope: "widget", description: "toggle Nerd Font glyph" },
  { key: "w", action: "edit-window", scope: "widget", description: "edit window/width" },
  { key: "Space", action: "cycle-char", scope: "separator", description: "cycle char" },
  { key: "Esc", action: "back", scope: "any", description: "back" },
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
