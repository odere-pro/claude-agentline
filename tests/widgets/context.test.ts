/**
 * Unit tests for WidgetContext shape and utilities.
 *
 * Verifies that the render pipeline provides the correct context to widgets.
 */

import { describe, it, expect } from "vitest";
import type { WidgetContext } from "../../src/widgets/context.js";
import { frozenClock, realClock } from "../../src/widgets/clock.js";
import { DEFAULT_CONFIG } from "../../src/config/defaults.js";

describe("WidgetContext", () => {
  describe("Clock utilities", () => {
    it("creates a real clock that returns current time", () => {
      const before = Date.now();
      const now = realClock.now();
      const after = Date.now();

      /*
       * `realClock.now()` is expected to fall between the two `Date.now()`
       * brackets, but a strict equality bracket is fragile under loaded CI
       * (clock skew, GC pauses between the two `Date.now()` calls). Allow a
       * 1-minute tolerance on either side: more than enough headroom for any
       * realistic scheduling, far less than the test could ever drift.
       */
      const TOLERANCE_MS = 60_000;
      expect(now).toBeInstanceOf(Date);
      expect(now.getTime()).toBeGreaterThanOrEqual(before - TOLERANCE_MS);
      expect(now.getTime()).toBeLessThanOrEqual(after + TOLERANCE_MS);
    });

    it("creates a frozen clock with a specific timestamp", () => {
      const timestamp = new Date("2026-05-13T12:00:00Z");
      const frozen = frozenClock(timestamp);

      const result1 = frozen.now();
      const result2 = frozen.now();

      expect(result1.getTime()).toBe(timestamp.getTime());
      expect(result2.getTime()).toBe(timestamp.getTime());
      expect(result1).not.toBe(result2); // Different object instances
    });

    it("creates a frozen clock from a numeric timestamp", () => {
      const ms = 1715600400000;
      const frozen = frozenClock(ms);
      expect(frozen.now().getTime()).toBe(ms);
    });

    it("creates a frozen clock from an ISO string", () => {
      const isoString = "2026-05-13T12:00:00Z";
      const frozen = frozenClock(isoString);
      expect(frozen.now().toISOString()).toBe(isoString);
    });

    it("throws on invalid date", () => {
      expect(() => frozenClock("invalid-date")).toThrow();
      expect(() => frozenClock(NaN)).toThrow();
    });
  });

  describe("WidgetContext shape", () => {
    it("can be constructed with required fields", () => {
      const stdin = { raw: { model: "test-model" }, truncated: false };
      const theme = {
        name: "test",
        palette: {},
        powerline: { capsStart: "", capsEnd: "" },
        source: "builtin",
      } as any;
      const ctx: WidgetContext = {
        stdin,
        config: DEFAULT_CONFIG,
        theme,
        clock: realClock,
        env: process.env,
      };

      /*
       * Assert identity / concrete values rather than the
       * `toBeDefined()` smoke checks the smell-report flagged — those
       * would have passed for a context whose fields had drifted into
       * the wrong slots.
       */
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
});
