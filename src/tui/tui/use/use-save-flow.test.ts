/**
 * `chainBackgroundRerender` — serialisation contract for the post-save
 * background rerender. Tested without React so the ordering guarantee is
 * a pure-function check, not an Ink integration assertion.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/defaults/defaults.js";
import type { AgentlineConfig } from "../../../data/config/types.js";

import { createSaveTracker } from "../mount.js";
import { chainBackgroundRerender } from "./use-save-flow.js";

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (e: unknown) => void;
} {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("chainBackgroundRerender", () => {
  it("starts each rerender only after the previous one settles, preserving submission order", async () => {
    const tracker = createSaveTracker();
    const cfg: AgentlineConfig = DEFAULT_CONFIG;

    const events: string[] = [];
    const d1 = deferred();
    const d2 = deferred();

    const trigger = (label: "a" | "b"): ((c: AgentlineConfig) => Promise<void>) => {
      return async () => {
        events.push(`start:${label}`);
        await (label === "a" ? d1.promise : d2.promise);
        events.push(`done:${label}`);
      };
    };

    const p1 = chainBackgroundRerender(tracker, cfg, trigger("a"));
    const p2 = chainBackgroundRerender(tracker, cfg, trigger("b"));

    // Flush microtasks so the first chain link enters `trigger("a")`.
    // The chain is `prev.catch().then(trigger)`, so it needs >= 2 ticks
    // before `trigger` is invoked.
    await new Promise((r) => setImmediate(r));
    expect(events).toEqual(["start:a"]);

    // Resolving B first must NOT let B run before A finishes.
    d2.resolve();
    await new Promise((r) => setImmediate(r));
    expect(events).toEqual(["start:a"]);

    // Resolve A: it completes, then B is allowed to start.
    d1.resolve();
    await p1;
    await p2;
    expect(events).toEqual(["start:a", "done:a", "start:b", "done:b"]);
    // Flush the housekeeping `.finally` that nulls `bgRerender`.
    await new Promise((r) => setImmediate(r));
    expect(tracker.bgRerender).toBeNull();
  });

  it("a transient failure does not poison subsequent rerenders", async () => {
    const tracker = createSaveTracker();
    const cfg: AgentlineConfig = DEFAULT_CONFIG;

    const events: string[] = [];
    const failing = async (): Promise<void> => {
      events.push("ran:fail");
      throw new Error("boom");
    };
    const ok = async (): Promise<void> => {
      events.push("ran:ok");
    };

    const p1 = chainBackgroundRerender(tracker, cfg, failing);
    const p2 = chainBackgroundRerender(tracker, cfg, ok);

    await expect(p1).rejects.toThrow("boom");
    await p2;
    expect(events).toEqual(["ran:fail", "ran:ok"]);
    await new Promise((r) => setImmediate(r));
    expect(tracker.bgRerender).toBeNull();
  });
});
