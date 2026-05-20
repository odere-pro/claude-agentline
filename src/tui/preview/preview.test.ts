/**
 * Tests for the editor's interactive preview region. The pure layout helper
 * `buildPreview` lives in `preview-model.ts` and is tested separately;
 * these tests target the Ink projection (`Preview`) with Ink mocked so we
 * never need a TTY. We assert on the React tree shape — selection
 * (`inverse: true`), add-cell presence, gutter, and that the cursor flags
 * one and only one slot per render.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ink", () => {
  const el = (type: unknown, props: unknown, ...children: unknown[]) => ({
    type,
    props,
    children: children.flat(Infinity),
  });
  return { Box: "Box", Text: "Text", default: el };
});

import React from "react";

import { DEFAULT_CONFIG } from "../../data/config/defaults/defaults.js";
import type { GitState } from "../../data/git/index.js";
import { resetPreviewModeCache, setPreviewModeForTesting } from "./preview-fixture.js";
import { contextWindowFor, type TokensSnapshot } from "../../data/tokens/index.js";
import { pickGlyphs } from "../tui/glyphs/glyphs.js";
import { Preview } from "./preview.js";

const realGit: GitState = Object.freeze({
  available: true,
  cwd: "/agentline",
  branch: "main",
  detached: false,
  sha: "0".repeat(40),
  shortSha: "0000000",
  status: Object.freeze({
    staged: 0,
    unstaged: 0,
    untracked: 0,
    conflicts: 0,
    modified: 0,
    added: 0,
  }),
  diff: Object.freeze({ insertions: 0, deletions: 0, filesChanged: 0 }),
  diffStaged: Object.freeze({ insertions: 0, deletions: 0, filesChanged: 0 }),
  aheadBehind: Object.freeze({ ahead: 0, behind: 0 }),
  upstream: null,
  origin: null,
  upstreamRemote: null,
  worktreeName: null,
  inWorktree: false,
  pr: null,
});

const realTokens: TokensSnapshot = Object.freeze({
  events: Object.freeze([]) as TokensSnapshot["events"],
  now: Date.parse("2026-05-13T11:00:00.000Z"),
  contextWindow: contextWindowFor("claude-opus-4-7"),
});

beforeEach(() => {
  setPreviewModeForTesting({
    source: "cache",
    payload: { raw: {}, truncated: false, model: "claude-opus-4-7", cwd: "/agentline" },
    session: { model: "claude-opus-4-7" },
    tokens: realTokens,
    git: realGit,
  });
});

afterEach(() => {
  resetPreviewModeCache();
});

/*
 * Walk the rendered tree and collect every <Text> node with its props +
 * the concatenated text of its children (each child is either a string or
 * another node — flatten to strings).
 */
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

/*
 * React.createElement nests children inside `props.children`. Normalise to
 * a flat array so wrap-line counts read cleanly.
 */
function previewChildren(node: unknown): unknown[] {
  const props = (node as { props?: { children?: unknown } } | undefined)?.props;
  const raw = props?.children;
  if (raw === undefined || raw === null) return [];
  return Array.isArray(raw) ? raw.flat(Infinity).filter((c) => c !== null) : [raw];
}

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
      lines: [
        { widgets: [{ type: "model" }, { type: "git-branch" }] },
        { widgets: [] },
        { widgets: [] },
      ],
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

  it("packs a wide row across multiple visual sub-lines when `columns` is tight", () => {
    /*
     * Eleven widget slots + ten separators + an add cell are well over what
     * a 40-column terminal can fit on one visual line. The packer should
     * emit more than one Box-line for row 0.
     */
    const node = Preview({
      base: DEFAULT_CONFIG,
      lines: [
        {
          widgets: [
            { type: "model" },
            { type: "thinking-effort" },
            { type: "git-branch" },
            { type: "git-changes" },
            { type: "context-percent" },
            { type: "tokens" },
            { type: "token-speed" },
            { type: "session-time" },
            { type: "version" },
            { type: "account-email" },
            { type: "context-tokens-used" },
          ],
        },
        { widgets: [] },
        { widgets: [] },
      ],
      cursor: { line: 0, widget: 0 },
      glyphs: GLYPHS,
      columns: 40,
    });
    /*
     * 3 rows produce 3 outer-Box children when no wrap; wrap on row 0
     * should add at least one continuation Box.
     */
    expect(previewChildren(node).length).toBeGreaterThan(3);
  });

  it("never wraps when `columns` is generous", () => {
    const node = Preview({
      base: DEFAULT_CONFIG,
      lines: [
        {
          widgets: [{ type: "model" }, { type: "git-branch" }, { type: "version" }],
        },
        { widgets: [] },
        { widgets: [] },
      ],
      cursor: { line: 0, widget: 0 },
      glyphs: GLYPHS,
      columns: 200,
    });
    // Exactly one outer-Box child per row (no header element) = 3 children.
    expect(previewChildren(node)).toHaveLength(3);
  });

  it("sizes the outer bordered box to the resolved terminal width", () => {
    for (const columns of [40, 120, 200]) {
      const node = Preview({
        base: DEFAULT_CONFIG,
        lines: [{ widgets: [{ type: "model" }] }, { widgets: [] }, { widgets: [] }],
        cursor: { line: 0, widget: 0 },
        glyphs: GLYPHS,
        columns,
      });
      // The border must span the full width regardless of how short the rows
      // are, so the panel never collapses to its content.
      expect((node.props as { width?: number }).width).toBe(columns);
    }
  });
});

/*
 * Regression: a configured widget that has no data for this session
 * (here `account-email` — the pinned cache session carries only model +
 * git) must stay in the preview as a dim identity chip regardless of
 * where the cursor sits. Before the fix `filterHiddenSlots` dropped it
 * unless it was the selected slot, so the line flickered while navigating.
 */
describe("Preview — configured-but-empty widgets stay visible", () => {
  const lines = [
    { widgets: [{ type: "model" }, { type: "account-email" }, { type: "git-branch" }] },
    { widgets: [] },
    { widgets: [] },
  ];

  function emailVisible(cursor: { line: number; widget: number }): boolean {
    const node = Preview({ base: DEFAULT_CONFIG, lines, cursor, glyphs: GLYPHS, columns: 200 });
    return collectTextNodes(node).some((t) => t.text.includes("account-email"));
  }

  it("shows the account-email chip for every cursor position on the row", () => {
    // widget 0 = model, 1 = account-email, 2 = git-branch, 3 = add-cell.
    for (const widget of [0, 1, 2, 3]) {
      expect(emailVisible({ line: 0, widget }), `cursor widget=${widget}`).toBe(true);
    }
  });

  it("shows the account-email chip even when the cursor is on another row", () => {
    expect(emailVisible({ line: 1, widget: 0 })).toBe(true);
  });

  it("keeps the row's slot set identical across cursor positions", () => {
    const textsAt = (widget: number): string[] => {
      const node = Preview({
        base: DEFAULT_CONFIG,
        lines,
        cursor: { line: 0, widget },
        glyphs: GLYPHS,
        columns: 200,
      });
      // Strip selection brackets so only the cursor highlight differs.
      return collectTextNodes(node)
        .map((t) =>
          t.text.split(GLYPHS.selectionOpen).join("").split(GLYPHS.selectionClose).join(""),
        )
        .filter((s) => s.trim().length > 0);
    };
    expect(textsAt(1)).toEqual(textsAt(3));
  });
});
