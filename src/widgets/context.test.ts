/**
 * WidgetContext shape guard (§7.1).
 *
 * The render pipeline hands every widget a `WidgetContext`. These tests
 * pin the contract's required/optional slots so a field that drifts into
 * the wrong slot fails loudly rather than passing a `toBeDefined()` smoke
 * check. Clock-utility behaviour is covered by clock.test.ts.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../data/config/defaults.js";
import { DEFAULT_PALETTE, type Theme } from "../data/theme/index.js";
import { frozenClock, realClock } from "./clock.js";
import type { WidgetContext } from "./context.js";

describe("WidgetContext shape", () => {
  it("can be constructed with required fields", () => {
    const stdin = { raw: { model: "test-model" }, truncated: false };
    const theme: Theme = {
      name: "test",
      palette: DEFAULT_PALETTE,
      powerline: { capsStart: "", capsEnd: "" },
      source: "builtin",
    };
    const ctx: WidgetContext = {
      stdin,
      config: DEFAULT_CONFIG,
      theme,
      clock: realClock,
      env: process.env,
    };

    expect(ctx.stdin).toBe(stdin);
    expect(ctx.stdin.truncated).toBe(false);
    expect(ctx.config).toBe(DEFAULT_CONFIG);
    expect(ctx.theme).toBe(theme);
    expect(ctx.clock.now()).toBeInstanceOf(Date);
    expect(ctx.env).toBe(process.env);
  });

  it("allows optional session, tokens, and git fields", () => {
    const ctx: WidgetContext = {
      stdin: {
        raw: {},
        truncated: false,
      },
      config: DEFAULT_CONFIG,
      theme: null,
      clock: frozenClock("2026-05-13T12:00:00Z"),
      env: {},
    };

    expect(ctx.session).toBeUndefined();
    expect(ctx.tokens).toBeUndefined();
    expect(ctx.git).toBeUndefined();
    expect(ctx.theme).toBeNull();
  });

  it("preserves theme as null when unconfigured", () => {
    const ctx: WidgetContext = {
      stdin: {
        raw: {},
        truncated: false,
      },
      config: DEFAULT_CONFIG,
      theme: null,
      clock: realClock,
      env: process.env,
    };

    expect(ctx.theme).toBeNull();
  });

  it("preserves custom env variables", () => {
    const customEnv = {
      AGENTLINE_DEBUG: "1",
      NODE_ENV: "test",
    };

    const ctx: WidgetContext = {
      stdin: {
        raw: {},
        truncated: false,
      },
      config: DEFAULT_CONFIG,
      theme: null,
      clock: realClock,
      env: customEnv,
    };

    expect(ctx.env.AGENTLINE_DEBUG).toBe("1");
    expect(ctx.env.NODE_ENV).toBe("test");
  });
});
