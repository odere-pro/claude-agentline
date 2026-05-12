import { afterEach, describe, expect, it, vi } from "vitest";

import { HelpRequestedError } from "../cli/help.js";
import { runWidgetSubgroup } from "./widget-command.js";

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

  it("propagates a bad-argument error from a subcommand", async () => {
    await expect(runWidgetSubgroup(["list", "--nope"])).rejects.toThrow(/unknown argument/);
  });
});
