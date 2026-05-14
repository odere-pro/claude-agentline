/**
 * Smoke test for runConfigCommand. The Ink renderer is mocked so the
 * test exercises the entry-point wiring (preloaded → result) without
 * mounting React or requiring a TTY. Reducer-level behaviour is
 * covered by state.test.ts; persist behaviour by persist.test.ts.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ink", () => {
  const noopElement = (..._args: unknown[]) => null;
  return {
    Box: noopElement,
    Text: noopElement,
    useApp: () => ({ exit: () => undefined }),
    useInput: (_handler: unknown) => undefined,
    render: () => ({
      waitUntilExit: () => Promise.resolve(),
      unmount: () => undefined,
    }),
  };
});

import { DEFAULT_CONFIG } from "../config/defaults.js";
import { DEFAULT_KEY_BINDINGS } from "../keys/bindings.js";
import {
  enterAltScreen,
  footerLines,
  fullscreenStream,
  pruneStaleWidgets,
  runConfigCommand,
} from "./main.js";

describe("runConfigCommand (entry-point wiring)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-tui-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns the preloaded path and saved=false when the editor exits without saving", async () => {
    const preloaded = { config: DEFAULT_CONFIG, path: join(tmp, "config.json") };
    const result = await runConfigCommand({ preloaded });
    expect(result.saved).toBe(false);
    expect(result.path).toBe(preloaded.path);
  });

  it("falls back to DEFAULT_CONFIG when no on-disk config can be loaded", async () => {
    // No preloaded input + a CLAUDE_CONFIG_DIR pointing at an empty tmp:
    // resolveStartingConfig hits the catch branch and returns DEFAULT_CONFIG.
    const result = await runConfigCommand({
      env: { CLAUDE_CONFIG_DIR: tmp },
    });
    expect(result.saved).toBe(false);
    expect(result.path).toContain("agentline");
  });

  it("project gate skips silently outside a Claude project on a non-TTY stdin", async () => {
    const stdin = new PassThrough() as NodeJS.ReadableStream & { isTTY?: boolean };
    stdin.isTTY = false;
    const result = await runConfigCommand({ cwd: tmp, stdin });
    expect(result.skipped).toBe(true);
    expect(result.saved).toBe(false);
    expect(result.path).toBe("");
  });
});

describe("pruneStaleWidgets", () => {
  it("drops widgets whose type isn't in the catalogue", () => {
    const config = {
      ...DEFAULT_CONFIG,
      lines: [
        { widgets: [{ type: "model" }, { type: "legacy-deleted-widget" }, { type: "git-branch" }] },
        { widgets: [{ type: "unknown-thing" }] },
      ],
    };
    const pruned = pruneStaleWidgets(config);
    expect(pruned.lines[0]?.widgets.map((w) => w.type)).toEqual(["model", "git-branch"]);
    expect(pruned.lines[1]?.widgets).toEqual([]);
  });

  it("returns the same object reference when no widgets are stale", () => {
    const config = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }, { type: "git-branch" }] }],
    };
    expect(pruneStaleWidgets(config)).toBe(config);
  });
});

describe("footerLines", () => {
  it("splits edit-scope bindings into motion (line 1) and actions (line 2)", () => {
    const { motion, actions } = footerLines(DEFAULT_KEY_BINDINGS, "edit");
    // Line 1 — motion / navigation: arrow keys for cursor + widget moves.
    expect(motion).toContain("← →");
    expect(motion).toContain("↑ ↓");
    expect(motion).toContain("⇧← ⇧→");
    expect(motion).toContain("⇧↑ ⇧↓");
    // Line 1 must NOT include action verbs.
    expect(motion).not.toContain("add");
    expect(motion).not.toContain("save");
    expect(motion).not.toContain("quit");
    // Line 2 — actions + the any-scope quit binding.
    expect(actions).toContain("add");
    expect(actions).toContain("save");
    expect(actions).toContain("quit");
  });

  it("picker-scope motion line carries picker-navigate; actions line carries the rest plus quit", () => {
    const { motion, actions } = footerLines(DEFAULT_KEY_BINDINGS, "picker-widget");
    expect(motion).toContain("navigate");
    expect(actions).toContain("confirm");
    expect(actions).toContain("back");
    expect(actions).toContain("quit");
  });

  it("returns empty strings rather than throwing when no bindings match a mode", () => {
    const { motion, actions } = footerLines([], "edit");
    expect(motion).toBe("");
    expect(actions).toBe("");
  });
});

describe("enterAltScreen", () => {
  /** Build a minimal WriteStream stub that records every `write` payload. */
  function makeStream(isTTY: boolean) {
    const writes: string[] = [];
    const stream = {
      isTTY,
      write(chunk: string | Uint8Array): boolean {
        writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
        return true;
      },
    } as unknown as NodeJS.WriteStream;
    return { stream, writes };
  }

  it("is a no-op when stdout is not a TTY", () => {
    const { stream, writes } = makeStream(false);
    const restore = enterAltScreen(stream);
    restore();
    expect(writes).toEqual([]);
  });

  it("writes the alt-screen enter sequence on call and the leave sequence on restore", () => {
    const { stream, writes } = makeStream(true);
    const restore = enterAltScreen(stream);
    expect(writes).toEqual(["\x1b[?1049h"]);
    restore();
    expect(writes).toEqual(["\x1b[?1049h", "\x1b[?1049l"]);
  });

  it("restore is idempotent — calling twice does not double-write the leave sequence", () => {
    const { stream, writes } = makeStream(true);
    const restore = enterAltScreen(stream);
    restore();
    restore();
    expect(writes.filter((s) => s === "\x1b[?1049l")).toHaveLength(1);
  });

  it("a SIGINT during the session triggers the leave sequence", () => {
    const { stream, writes } = makeStream(true);
    const restore = enterAltScreen(stream);
    // The handler is installed via `process.once`, so emitting once is
    // enough; the test process is otherwise untouched (Ink isn't mounted).
    process.emit("SIGINT");
    expect(writes).toContain("\x1b[?1049l");
    restore(); // tidy any remaining listener
  });
});

describe("fullscreenStream", () => {
  function makeStream(isTTY: boolean) {
    const writes: string[] = [];
    const stream = {
      isTTY,
      columns: 80,
      rows: 24,
      write(chunk: string | Uint8Array): boolean {
        writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
        return true;
      },
    } as unknown as NodeJS.WriteStream;
    return { stream, writes };
  }

  it("returns the stream unchanged when stdout is not a TTY", () => {
    const { stream } = makeStream(false);
    expect(fullscreenStream(stream)).toBe(stream);
  });

  it("prepends cursor-home + erase-screen on every write batch", () => {
    const { stream, writes } = makeStream(true);
    const wrapped = fullscreenStream(stream);
    wrapped.write("frame-one");
    wrapped.write("frame-two");
    expect(writes).toEqual(["\x1b[H\x1b[2Jframe-one", "\x1b[H\x1b[2Jframe-two"]);
  });

  it("forwards passthrough properties like columns/rows", () => {
    const { stream } = makeStream(true);
    const wrapped = fullscreenStream(stream);
    expect(wrapped.columns).toBe(80);
    expect(wrapped.rows).toBe(24);
    expect(wrapped.isTTY).toBe(true);
  });

  it("handles Uint8Array chunks by converting to string before prepending the reset", () => {
    const { stream, writes } = makeStream(true);
    const wrapped = fullscreenStream(stream);
    wrapped.write(Buffer.from("buffered"));
    expect(writes).toEqual(["\x1b[H\x1b[2Jbuffered"]);
  });
});
