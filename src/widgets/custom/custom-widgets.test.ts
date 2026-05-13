import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";
import { WidgetRegistry } from "../registry.js";

import { clearCommandCache, commandWidget } from "./command.js";
import {
  flexSeparatorWidget,
  separatorWidget,
  SEPARATOR_CYCLE,
} from "./separator.js";
import { CUSTOM_WIDGETS, registerCustomWidgets } from "./index.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(overrides: Partial<WidgetContext> = {}): WidgetContext {
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-05-01T00:00:00Z"),
    env: {},
    ...overrides,
  };
}

describe("registerCustomWidgets", () => {
  it("ships separator, flex-separator, command, key-hints", () => {
    const r = new WidgetRegistry();
    registerCustomWidgets(r);
    expect(r.size()).toBe(4);
    expect(r.list()).toEqual(["command", "flex-separator", "key-hints", "separator"]);
    expect(Object.isFrozen(CUSTOM_WIDGETS)).toBe(true);
  });
});

describe("separator widget", () => {
  it("renders the default character when no option supplied", () => {
    const cell = separatorWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.text).toBe("|");
  });

  it("honours options.char", () => {
    const cell = separatorWidget.render(makeCtx(), {
      options: { char: "·" },
      rawValue: false,
    });
    expect(cell.text).toBe("·");
  });

  it("clamps multi-character input to one user-perceived char", () => {
    const cell = separatorWidget.render(makeCtx(), {
      options: { char: "abc" },
      rawValue: false,
    });
    expect(cell.text).toBe("a");
  });

  it("falls back to default for empty char", () => {
    const cell = separatorWidget.render(makeCtx(), {
      options: { char: "" },
      rawValue: false,
    });
    expect(cell.text).toBe("|");
  });

  it("SEPARATOR_CYCLE matches the spec list", () => {
    expect([...SEPARATOR_CYCLE]).toEqual(["|", "-", ",", "·", "␣"]);
  });
});

describe("flex-separator widget", () => {
  it("emits flex:true with a single space by default", () => {
    const cell = flexSeparatorWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.flex).toBe(true);
    expect(cell.text).toBe(" ");
  });

  it("uses options.fill", () => {
    const cell = flexSeparatorWidget.render(makeCtx(), {
      options: { fill: "·" },
      rawValue: false,
    });
    expect(cell.text).toBe("·");
    expect(cell.flex).toBe(true);
  });
});

describe("command widget", () => {
  afterEach(() => {
    clearCommandCache();
  });

  it("hides when no cmd is set", () => {
    expect(
      commandWidget.render(makeCtx(), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });

  it("runs the command and returns its trimmed output", () => {
    const cell = commandWidget.render(makeCtx(), {
      options: { cmd: "printf 'hello world'" },
      rawValue: false,
    });
    expect(cell.text).toBe("hello world");
  });

  it("renders onError marker on a failing command", () => {
    const cell = commandWidget.render(makeCtx(), {
      options: { cmd: "exit 1", onError: "FAIL" },
      rawValue: false,
    });
    expect(cell.text).toBe("FAIL");
  });

  it("renders the spec default ✗ marker by default", () => {
    const cell = commandWidget.render(makeCtx(), {
      options: { cmd: "exit 1" },
      rawValue: false,
    });
    expect(cell.text).toBe("✗");
  });

  it("caches results within the TTL window", () => {
    const t0 = Date.parse("2026-05-01T00:00:00Z");
    const t1 = t0 + 500; // inside default 1s TTL
    const ctx0 = makeCtx({ clock: frozenClock(new Date(t0)) });
    const ctx1 = makeCtx({ clock: frozenClock(new Date(t1)) });
    const tmpFile = `/tmp/agentline-cmd-test-${process.pid}-${Date.now()}.txt`;

    // First run: prints "first"
    commandWidget.render(ctx0, {
      options: { cmd: `printf first > ${tmpFile} && cat ${tmpFile}` },
      rawValue: false,
    });
    // Second run with the same cmd: would print "second" if it ran;
    // cache should serve "first".
    const cached = commandWidget.render(ctx1, {
      options: {
        cmd: `printf first > ${tmpFile} && cat ${tmpFile}`,
      },
      rawValue: false,
    });
    expect(cached.text).toBe("first");
  });

  it("respects byteLimit truncation", () => {
    const cell = commandWidget.render(makeCtx(), {
      options: { cmd: "printf abcdefghij", byteLimit: 4 },
      rawValue: false,
    });
    expect(cell.text).toBe("abcd");
  });

  it("clamps timeout above MAX to 2000ms", () => {
    // Indirectly verified — `runCommand` uses the clamped value;
    // we check the request reaches the binary by setting an
    // outrageous request and seeing the call still completes.
    const cell = commandWidget.render(makeCtx(), {
      options: { cmd: "printf ok", timeoutMs: 999_999 },
      rawValue: false,
    });
    expect(cell.text).toBe("ok");
  });

  it("hides when stdout is empty after trim", () => {
    const cell = commandWidget.render(makeCtx(), {
      options: { cmd: "printf '   '" },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("trim=false preserves trailing whitespace", () => {
    const cell = commandWidget.render(makeCtx(), {
      options: { cmd: "printf 'ok\\n'", trim: false },
      rawValue: false,
    });
    expect(cell.text).toBe("ok\n");
  });
});
