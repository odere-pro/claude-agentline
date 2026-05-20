import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { HelpRequestedError } from "../../../core/lib/help/help.js";
import { parseWidgetAddArgs, runWidgetAddCommand } from "../widget/add/add.js";
import type { parseWidgetRemoveArgs } from "../widget/remove/remove.js";
import { WIDGET_SUBS, defineWidgetSub, runWidgetSubgroup } from "./widget-command.js";

/**
 * The `run` argument `defineWidgetSub<TArgs>` will accept once `TArgs`
 * has been inferred from a given `parse` function. Mirrors the real
 * second-parameter type so the linkage can be asserted at the type
 * level without casts or `@ts-expect-error`.
 */
type RunFor<TParse extends (rest: readonly string[]) => unknown> = (input: {
  readonly args: ReturnType<TParse>;
}) => Promise<number>;

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

describe("defineWidgetSub type linkage", () => {
  it("accepts a matched parse/run pair and ties the two to one args type", () => {
    const sub = defineWidgetSub(parseWidgetAddArgs, runWidgetAddCommand);
    expect(sub.parse).toBeTypeOf("function");
    expect(sub.run).toBeTypeOf("function");

    // `run` is valid for the args its own `parse` yields.
    expectTypeOf(runWidgetAddCommand).toExtend<RunFor<typeof parseWidgetAddArgs>>();
  });

  it("rejects a parse/run pair whose args shapes disagree", () => {
    /*
     * `defineWidgetSub<TArgs>` infers `TArgs` from `parse` and then
     * requires `run` to accept `{ args: TArgs }`. A parse fn yielding
     * WidgetRemoveArgs cannot be paired with runWidgetAddCommand
     * (WidgetRemoveArgs is missing `type`), so the latter is not a
     * valid `run` for that parse. Asserting the divergence at the type
     * level guards the linkage without silencing the compiler — if the
     * arg shapes ever converge, this assertion fails to type-check.
     */
    expectTypeOf(runWidgetAddCommand).not.toExtend<RunFor<typeof parseWidgetRemoveArgs>>();
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
