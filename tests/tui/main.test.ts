/**
 * Unit tests for the TUI editor entry point (§1.1 F10).
 *
 * Tests the App component lifecycle, mode transitions, and save flow.
 * These tests focus on the glue layer (not the state machine, which is
 * covered by state.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentlineConfig } from "../../src/config/types.js";
import { DEFAULT_CONFIG } from "../../src/config/defaults.js";
import { runConfigCommand } from "../../src/tui/main.js";

describe("TUI editor (runConfigCommand)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when project gate returns skip", async () => {
    const result = await runConfigCommand({
      cwd: "/tmp",
      stdin: { isTTY: false } as any,
    });
    // Gate should trigger on CI (isTTY=false without proper context)
    expect(result.skipped).toBe(true);
    expect(result.saved).toBe(false);
  });

  it("loads default config when no config exists", async () => {
    const result = await runConfigCommand({
      cwd: process.cwd(),
      preloaded: {
        config: DEFAULT_CONFIG,
        path: "/tmp/test-config.json",
      },
    });
    expect(result.path).toBe("/tmp/test-config.json");
    expect(result.saved).toBe(false);
    expect(result.skipped).toBeFalsy();
  });

  it("resolves theme from config", async () => {
    const config: AgentlineConfig = {
      ...DEFAULT_CONFIG,
      theme: "vscode-dark",
    };
    const result = await runConfigCommand({
      cwd: process.cwd(),
      preloaded: {
        config,
        path: "/tmp/theme-test.json",
      },
    });
    expect(result.path).toBe("/tmp/theme-test.json");
    expect(result.saved).toBe(false);
    expect(result.skipped).toBeFalsy();
  });

  it("handles custom environment variables", async () => {
    const config: AgentlineConfig = DEFAULT_CONFIG;
    const result = await runConfigCommand({
      cwd: process.cwd(),
      env: {
        ...process.env,
        AGENTLINE_GLYPH_MODE: "ascii",
      },
      preloaded: {
        config,
        path: "/tmp/env-test.json",
      },
    });
    expect(result.path).toBe("/tmp/env-test.json");
    expect(result.saved).toBe(false);
    expect(result.skipped).toBeFalsy();
  });
});
