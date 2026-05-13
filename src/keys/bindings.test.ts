import { describe, expect, it } from "vitest";

import { DEFAULT_KEY_BINDINGS, listBindings, type KeyScope } from "./bindings.js";

describe("DEFAULT_KEY_BINDINGS", () => {
  it("is frozen and contains every §5.5 row", () => {
    expect(Object.isFrozen(DEFAULT_KEY_BINDINGS)).toBe(true);
    const actions = DEFAULT_KEY_BINDINGS.map((b) => b.action);
    expect(new Set(actions).size).toBe(actions.length);
    // All §5.5 actions must be present (kept in sync with gate-17's list).
    const required = [
      "move-cursor",
      "move-cursor-row",
      "move-widget",
      "move-widget-row",
      "edit-widget",
      "add",
      "replace",
      "update",
      "delete",
      "options",
      "save",
      "picker-filter",
      "picker-navigate",
      "picker-confirm",
      "picker-back",
      "toggle-visible",
      "toggle-label",
      "cycle-spacing",
      "options-close",
      "quit",
      "help",
    ];
    for (const action of required) {
      expect(actions, `missing action: ${action}`).toContain(action);
    }
  });

  it("every binding has a non-empty key, scope, and description", () => {
    for (const b of DEFAULT_KEY_BINDINGS) {
      expect(b.key.length).toBeGreaterThan(0);
      expect(b.scope.length).toBeGreaterThan(0);
      expect(b.description.length).toBeGreaterThan(0);
    }
  });

  it("scopes are drawn from the editor's modes", () => {
    const allowedScopes: ReadonlySet<KeyScope> = new Set<KeyScope>([
      "edit",
      "picker",
      "options",
      "any",
    ]);
    for (const b of DEFAULT_KEY_BINDINGS) {
      expect(allowedScopes.has(b.scope)).toBe(true);
    }
  });
});

describe("listBindings (overrides)", () => {
  it("returns the default table verbatim when no overrides are given", () => {
    expect(listBindings()).toBe(DEFAULT_KEY_BINDINGS);
    expect(listBindings({})).toBe(DEFAULT_KEY_BINDINGS);
  });

  it("layers override keys on top of the matching action", () => {
    const out = listBindings({ delete: "x", add: "+" });
    const del = out.find((b) => b.action === "delete");
    const add = out.find((b) => b.action === "add");
    expect(del?.key).toBe("x");
    expect(add?.key).toBe("+");
  });

  it("ignores overrides that don't match a known action", () => {
    const out = listBindings({ "no-such-action": "?" });
    expect(out).toHaveLength(DEFAULT_KEY_BINDINGS.length);
  });
});
