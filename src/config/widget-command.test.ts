import { afterEach, describe, expect, it, vi } from "vitest";

import { HelpRequestedError } from "../cli/help.js";
import { WIDGET_SUBS, runWidgetSubgroup } from "./widget-command.js";

const EXPECTED_SUBS = [
  "list",
  "catalog",
  "add",
  "remove",
  "move",
  "replace",
  "set-option",
] as const;

describe("WIDGET_SUBS dispatch table", () => {
  it("exposes every documented subcommand with parse + run pairs", () => {
    for (const sub of EXPECTED_SUBS) {
      expect(WIDGET_SUBS[sub]?.parse).toBeTypeOf("function");
      expect(WIDGET_SUBS[sub]?.run).toBeTypeOf("function");
    }
  });

  it("exposes exactly the documented surface (no surprise entries)", () => {
    expect(Object.keys(WIDGET_SUBS).sort()).toEqual([...EXPECTED_SUBS].sort());
  });

  it("is frozen", () => {
    expect(Object.isFrozen(WIDGET_SUBS)).toBe(true);
  });
});

describe("runWidgetSubgroup", () => {
  afterEach(() => vi.restoreAllMocks());

  it("routes `catalog` and exits 0", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runWidgetSubgroup(["catalog", "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "")) as { widgets: unknown[] };
    expect(parsed.widgets.length).toBeGreaterThan(0);
  });

  it("routes `list` and exits 0", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(await runWidgetSubgroup(["list", "--json"])).toBe(0);
  });

  it("shows help (exit 0 via HelpRequestedError) for no subcommand", async () => {
    await expect(runWidgetSubgroup([])).rejects.toBeInstanceOf(HelpRequestedError);
  });

  it("shows help for --help / help", async () => {
    await expect(runWidgetSubgroup(["--help"])).rejects.toBeInstanceOf(HelpRequestedError);
    await expect(runWidgetSubgroup(["help"])).rejects.toBeInstanceOf(HelpRequestedError);
  });

  it("returns 1 and prints help for an unknown subcommand", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(await runWidgetSubgroup(["bogus"])).toBe(1);
    expect(String(stderr.mock.calls[0]?.[0] ?? "")).toContain("unknown subcommand 'bogus'");
  });

  it("routes `add` (arg-parse and mutation errors surface)", async () => {
    await expect(runWidgetSubgroup(["add"])).rejects.toThrow(/<type> is required/);
    await expect(runWidgetSubgroup(["add", "no-such-widget"])).rejects.toThrow(
      /unknown widget type/,
    );
  });

  it("routes `remove` (requires --at)", async () => {
    await expect(runWidgetSubgroup(["remove"])).rejects.toThrow(/--at <index> is required/);
  });

  it("routes `move` / `replace` / `set-option`", async () => {
    await expect(runWidgetSubgroup(["move"])).rejects.toThrow(/--from-at <index> is required/);
    await expect(runWidgetSubgroup(["replace"])).rejects.toThrow(/replacement <type> is required/);
    await expect(runWidgetSubgroup(["set-option"])).rejects.toThrow(
      /<key> and a <value> are required/,
    );
  });

  it("propagates a bad-argument error from a subcommand", async () => {
    await expect(runWidgetSubgroup(["list", "--nope"])).rejects.toThrow(/unknown argument/);
  });
});
