import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "./defaults.js";
import {
  ConfigMutationError,
  MAX_LINES,
  addWidget,
  moveWidget,
  removeWidget,
  replaceWidget,
  saveAddWidget,
  saveMoveWidget,
  setTheme,
  setWidgetOption,
} from "./mutate.js";
import type { AgentlineConfig, WidgetConfig } from "./types.js";

function cfgWith(lines: WidgetConfig[][]): AgentlineConfig {
  return { ...DEFAULT_CONFIG, lines: lines.map((widgets) => ({ widgets })) };
}

const baseline = (): AgentlineConfig =>
  cfgWith([[{ type: "model" }, { type: "git-branch" }, { type: "version" }]]);

describe("addWidget", () => {
  it("inserts at the given index", () => {
    const out = addWidget(baseline(), {
      line: 0,
      at: 1,
      widget: { type: "session-weekly-usage" },
    });
    expect(out.lines[0]?.widgets.map((w) => w.type)).toEqual([
      "model",
      "session-weekly-usage",
      "git-branch",
      "version",
    ]);
  });

  it("appends when `at` is omitted", () => {
    const out = addWidget(baseline(), { line: 0, widget: { type: "version" } });
    expect(out.lines[0]?.widgets.map((w) => w.type)).toEqual([
      "model",
      "git-branch",
      "version",
      "version",
    ]);
  });

  it("pads with empty lines when targeting a higher line", () => {
    const out = addWidget(cfgWith([[{ type: "model" }]]), { line: 2, widget: { type: "version" } });
    expect(out.lines).toHaveLength(3);
    expect(out.lines[1]?.widgets).toEqual([]);
    expect(out.lines[2]?.widgets.map((w) => w.type)).toEqual(["version"]);
  });

  it("does not mutate the input config", () => {
    const input = baseline();
    const snapshot = structuredClone(input);
    addWidget(input, { line: 0, at: 0, widget: { type: "session-weekly-usage" } });
    expect(input).toEqual(snapshot);
  });

  it("rejects an unknown widget type", () => {
    expect(() => addWidget(baseline(), { line: 0, widget: { type: "totally-made-up" } })).toThrow(
      /unknown widget type 'totally-made-up'/,
    );
  });

  it("rejects an empty widget type", () => {
    expect(() => addWidget(baseline(), { line: 0, widget: { type: "" } })).toThrow(
      ConfigMutationError,
    );
  });

  it("rejects a line index at or beyond the cap", () => {
    expect(() => addWidget(baseline(), { line: MAX_LINES, widget: { type: "version" } })).toThrow(
      /exceeds the 3-line limit/,
    );
    expect(() => addWidget(baseline(), { line: -1, widget: { type: "version" } })).toThrow(
      ConfigMutationError,
    );
  });

  it("rejects an out-of-range insert index", () => {
    expect(() => addWidget(baseline(), { line: 0, at: 99, widget: { type: "version" } })).toThrow(
      /insert index 99 out of range/,
    );
  });
});

describe("removeWidget", () => {
  it("drops the widget at the index", () => {
    const out = removeWidget(baseline(), { line: 0, at: 1 });
    expect(out.lines[0]?.widgets.map((w) => w.type)).toEqual(["model", "version"]);
  });

  it("keeps an emptied line in place", () => {
    const out = removeWidget(cfgWith([[{ type: "model" }]]), { line: 0, at: 0 });
    expect(out.lines).toEqual([{ widgets: [] }]);
  });

  it("rejects an unknown line", () => {
    expect(() => removeWidget(baseline(), { line: 1, at: 0 })).toThrow(/no line at index 1/);
  });

  it("rejects an out-of-range widget index", () => {
    expect(() => removeWidget(baseline(), { line: 0, at: 5 })).toThrow(/no widget at index 5/);
    expect(() => removeWidget(baseline(), { line: 0, at: -1 })).toThrow(ConfigMutationError);
  });
});

describe("replaceWidget", () => {
  it("swaps the widget at the index, preserving siblings", () => {
    const out = replaceWidget(baseline(), { line: 0, at: 0, widget: { type: "version" } });
    expect(out.lines[0]?.widgets.map((w) => w.type)).toEqual(["version", "git-branch", "version"]);
  });

  it("rejects an unknown replacement type", () => {
    expect(() => replaceWidget(baseline(), { line: 0, at: 0, widget: { type: "nope" } })).toThrow(
      /unknown widget type/,
    );
  });

  it("rejects an out-of-range index", () => {
    expect(() => replaceWidget(baseline(), { line: 0, at: 9, widget: { type: "version" } })).toThrow(
      /no widget at index 9/,
    );
  });
});

describe("moveWidget", () => {
  it("reorders within a line (destination index is post-removal)", () => {
    const out = moveWidget(baseline(), { fromLine: 0, fromAt: 0, toLine: 0, toAt: 2 });
    expect(out.lines[0]?.widgets.map((w) => w.type)).toEqual(["git-branch", "version", "model"]);
  });

  it("appends to a line when `toAt` is omitted", () => {
    const out = moveWidget(baseline(), { fromLine: 0, fromAt: 1, toLine: 0 });
    expect(out.lines[0]?.widgets.map((w) => w.type)).toEqual(["model", "version", "git-branch"]);
  });

  it("moves a widget to another (padded) line", () => {
    const out = moveWidget(cfgWith([[{ type: "model" }, { type: "version" }]]), {
      fromLine: 0,
      fromAt: 1,
      toLine: 2,
    });
    expect(out.lines).toHaveLength(3);
    expect(out.lines[0]?.widgets.map((w) => w.type)).toEqual(["model"]);
    expect(out.lines[1]?.widgets).toEqual([]);
    expect(out.lines[2]?.widgets.map((w) => w.type)).toEqual(["version"]);
  });

  it("rejects a destination line at the cap", () => {
    expect(() => moveWidget(baseline(), { fromLine: 0, fromAt: 0, toLine: MAX_LINES })).toThrow(
      /exceeds the 3-line limit/,
    );
  });

  it("rejects an unknown source line or index", () => {
    expect(() => moveWidget(baseline(), { fromLine: 2, fromAt: 0, toLine: 0 })).toThrow(
      /no line at index 2/,
    );
    expect(() => moveWidget(baseline(), { fromLine: 0, fromAt: 7, toLine: 0 })).toThrow(
      /no widget at index 7/,
    );
  });
});

describe("setWidgetOption", () => {
  it("sets a fresh option object", () => {
    const out = setWidgetOption(baseline(), { line: 0, at: 2, key: "format", value: "%H:%M" });
    expect(out.lines[0]?.widgets[2]).toEqual({ type: "version", options: { format: "%H:%M" } });
  });

  it("merges into an existing option object without touching the original", () => {
    const input = cfgWith([[{ type: "tokens", options: { reset: "block" } }]]);
    const out = setWidgetOption(input, { line: 0, at: 0, key: "format", value: "human" });
    expect(out.lines[0]?.widgets[0]?.options).toEqual({ reset: "block", format: "human" });
    expect(input.lines[0]?.widgets[0]?.options).toEqual({ reset: "block" });
  });

  it("rejects an empty key", () => {
    expect(() => setWidgetOption(baseline(), { line: 0, at: 0, key: "  ", value: 1 })).toThrow(
      /non-empty string/,
    );
  });

  it("rejects prototype-polluting keys", () => {
    expect(() =>
      setWidgetOption(baseline(), { line: 0, at: 0, key: "__proto__", value: {} }),
    ).toThrow(/not allowed/);
  });

  it("rejects an out-of-range widget index", () => {
    expect(() => setWidgetOption(baseline(), { line: 0, at: 9, key: "x", value: 1 })).toThrow(
      /no widget at index 9/,
    );
  });
});

describe("setTheme", () => {
  it("sets a theme id", () => {
    expect(setTheme(baseline(), "claude-code-dark").theme).toBe("claude-code-dark");
  });

  it("accepts null", () => {
    expect(setTheme(baseline(), null).theme).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(() => setTheme(baseline(), "   ")).toThrow(ConfigMutationError);
  });

  it("does not mutate the input", () => {
    const input = baseline();
    setTheme(input, "nord");
    expect(input.theme).toBe(DEFAULT_CONFIG.theme);
  });
});

describe("disk wrappers", () => {
  let claudeCfgDir: string;
  let userCfg: string;

  beforeEach(async () => {
    claudeCfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-mutate-"));
    userCfg = join(claudeCfgDir, "agentline", "config.json");
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(
      userCfg,
      JSON.stringify({ version: 1, lines: [{ widgets: [{ type: "model" }] }] }),
    );
  });

  afterEach(async () => {
    await fs.rm(claudeCfgDir, { recursive: true, force: true });
  });

  it("saveAddWidget loads, mutates, validates, and atomically writes the merged config", async () => {
    const next = await saveAddWidget(
      { line: 0, widget: { type: "version" } },
      { env: { CLAUDE_CONFIG_DIR: claudeCfgDir } },
    );
    expect(next.lines[0]?.widgets.map((w) => w.type)).toEqual(["model", "version"]);

    const onDisk = JSON.parse(await fs.readFile(userCfg, "utf8")) as AgentlineConfig;
    expect(onDisk.lines[0]?.widgets.map((w) => w.type)).toEqual(["model", "version"]);
    // The full merged tree is materialised, so defaulted keys are present.
    expect(onDisk.global.padding).toBe(DEFAULT_CONFIG.global.padding);
  });

  it("saveMoveWidget round-trips through disk", async () => {
    await saveAddWidget(
      { line: 0, widget: { type: "version" } },
      { env: { CLAUDE_CONFIG_DIR: claudeCfgDir } },
    );
    await saveMoveWidget(
      { fromLine: 0, fromAt: 0, toLine: 0, toAt: 1 },
      { env: { CLAUDE_CONFIG_DIR: claudeCfgDir } },
    );
    const onDisk = JSON.parse(await fs.readFile(userCfg, "utf8")) as AgentlineConfig;
    expect(onDisk.lines[0]?.widgets.map((w) => w.type)).toEqual(["version", "model"]);
  });

  it("propagates a mutation error without writing", async () => {
    const before = await fs.readFile(userCfg, "utf8");
    await expect(
      saveAddWidget(
        { line: 0, widget: { type: "made-up" } },
        { env: { CLAUDE_CONFIG_DIR: claudeCfgDir } },
      ),
    ).rejects.toThrow(/unknown widget type/);
    expect(await fs.readFile(userCfg, "utf8")).toBe(before);
  });
});
