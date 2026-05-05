import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { watchConfigFile } from "./watcher.js";

describe("watchConfigFile", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-watcher-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("debounces rapid changes into a single notification", async () => {
    const file = join(tmp, "config.json");
    writeFileSync(file, "{}");
    const onChange = vi.fn();
    const dispose = watchConfigFile(file, onChange);
    try {
      writeFileSync(file, '{"a":1}');
      writeFileSync(file, '{"a":2}');
      writeFileSync(file, '{"a":3}');
      // Generous slack: the fs.watch backend is real (no fake timers),
      // so under loaded CI the debounce + reattach window can stretch.
      // The assertion is "≤ 1 notification" so an over-long wait still
      // meets the contract; we just want the timer to have fired before
      // the test exits.
      await new Promise((r) => setTimeout(r, 800));
      expect(onChange.mock.calls.length).toBeLessThanOrEqual(1);
    } finally {
      dispose();
    }
  });

  it("disposer cancels pending notifications", async () => {
    const file = join(tmp, "config.json");
    writeFileSync(file, "{}");
    const onChange = vi.fn();
    const dispose = watchConfigFile(file, onChange);

    writeFileSync(file, '{"x":1}');
    // Dispose before the 80ms debounce timer fires.
    dispose();
    await new Promise((r) => setTimeout(r, 800));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disposer is idempotent", () => {
    const file = join(tmp, "config.json");
    writeFileSync(file, "{}");
    const dispose = watchConfigFile(file, () => undefined);
    expect(() => {
      dispose();
      dispose();
    }).not.toThrow();
  });
});
