/**
 * Tests for the editor's interactive preview region. The pure layout helper
 * `buildPreview` lives in `preview-model.ts` and is tested separately;
 * these tests target the Ink projection (`Preview`) with Ink mocked so we
 * never need a TTY. We assert on the React tree shape — selection
 * (`inverse: true`), add-cell presence, gutter, and that the cursor flags
 * one and only one slot per render.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("ink", () => {
  const el = (type: unknown, props: unknown, ...children: unknown[]) => ({
    type,
    props,
    children: children.flat(Infinity),
  });
  return { Box: "Box", Text: "Text", default: el };
});

import React from "react";

import { DEFAULT_CONFIG } from "../config/defaults.js";
import { pickGlyphs } from "./glyphs.js";
import { Preview } from "./preview.js";

// Walk the rendered tree and collect every <Text> node with its props +
// the concatenated text of its children (each child is either a string or
// another node — flatten to strings).
interface TextNode {
  readonly props: Record<string, unknown>;
  readonly text: string;
}

function collectTextNodes(node: unknown): TextNode[] {
  const out: TextNode[] = [];
  function walk(n: unknown): void {
    if (!n || typeof n !== "object") return;
    const el = n as { type?: unknown; props?: Record<string, unknown> };
    const props = el.props ?? {};
    if (el.type === "Text") {
      const text = collectText(props.children);
      out.push({ props, text });
      return; // a Text's children are leaves
    }
    walk((props as { children?: unknown }).children);
    if (Array.isArray((props as { children?: unknown }).children)) {
      for (const child of (props as { children: unknown[] }).children) walk(child);
    }
  }
  function collectText(children: unknown): string {
    if (children === undefined || children === null) return "";
    if (typeof children === "string") return children;
    if (Array.isArray(children)) return children.map(collectText).join("");
    if (typeof children === "object") {
      const c = children as { props?: { children?: unknown } };
      return collectText(c.props?.children);
    }
    return String(children);
  }
  walk(node);
  return out;
}

const GLYPHS = pickGlyphs({ unicode: true });

describe("Preview — projection", () => {
  it("renders a Text node per supplied line plus the add-cell on each row", () => {
    const node = Preview({
      base: DEFAULT_CONFIG,
      lines: [
        { widgets: [{ type: "model" }] },
        { widgets: [] },
        { widgets: [{ type: "git-branch" }] },
      ],
      cursor: { line: 0, widget: 0 },
      glyphs: GLYPHS,
    });
    const texts = collectTextNodes(node);
    const addCells = texts.filter((t) => t.text.includes("add widget"));
    expect(addCells).toHaveLength(3); // one per row
  });

  it("inverses exactly one slot per render — the cursor target", () => {
    const node = Preview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }, { type: "git-branch" }] }, { widgets: [] }, { widgets: [] }],
      cursor: { line: 0, widget: 1 },
      glyphs: GLYPHS,
    });
    const inversed = collectTextNodes(node).filter((t) => t.props.inverse === true);
    expect(inversed).toHaveLength(1);
    // The selected widget is `git-branch` — `main` in the demo session.
    expect(inversed[0]?.text).toContain("main");
  });

  it("highlights the add-cell when the cursor sits on the column past the last widget", () => {
    const node = Preview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }] }, { widgets: [] }, { widgets: [] }],
      cursor: { line: 0, widget: 1 },
      glyphs: GLYPHS,
    });
    const inversed = collectTextNodes(node).filter((t) => t.props.inverse === true);
    expect(inversed).toHaveLength(1);
    expect(inversed[0]?.text).toContain("add widget");
  });

  it("an empty row's only navigable slot is its add-cell at column 0", () => {
    const node = Preview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [] }, { widgets: [] }, { widgets: [] }],
      cursor: { line: 1, widget: 0 },
      glyphs: GLYPHS,
    });
    const inversed = collectTextNodes(node).filter((t) => t.props.inverse === true);
    expect(inversed).toHaveLength(1);
    expect(inversed[0]?.text).toContain("add widget");
  });

  it("wraps the selected widget in selection brackets", () => {
    const node = Preview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }] }, { widgets: [] }, { widgets: [] }],
      cursor: { line: 0, widget: 0 },
      glyphs: GLYPHS,
    });
    const inv = collectTextNodes(node).filter((t) => t.props.inverse === true);
    expect(inv[0]?.text.startsWith(GLYPHS.selectionOpen)).toBe(true);
    expect(inv[0]?.text.endsWith(GLYPHS.selectionClose)).toBe(true);
  });

  it("returns a React element", () => {
    expect(
      Preview({
        base: DEFAULT_CONFIG,
        lines: [{ widgets: [] }, { widgets: [] }, { widgets: [] }],
        cursor: { line: 0, widget: 0 },
        glyphs: GLYPHS,
      }),
    ).toBeTruthy();
  });

  // Reference React so the import isn't flagged as unused on stricter TS configs.
  it("imports React (smoke)", () => {
    expect(React).toBeDefined();
  });
});
