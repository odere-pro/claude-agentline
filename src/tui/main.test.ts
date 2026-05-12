/**
 * Smoke test for runConfigCommand. The Ink renderer is mocked so the
 * test exercises the entry-point wiring (preloaded → result) without
 * mounting React or requiring a TTY. Reducer-level behaviour is
 * covered by state.test.ts; persist behaviour by persist.test.ts.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
import { runConfigCommand } from "./main.js";

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
});
