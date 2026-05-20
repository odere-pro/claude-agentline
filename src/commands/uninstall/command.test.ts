import { describe, expect, it } from "vitest";

import { HelpRequestedError } from "../../core/lib/help/help.js";
import { RENDER_CACHE_VERSION } from "../../data/state/render-cache/render-cache.js";
import { formatLastRenderBanner, parseUninstallArgs } from "./command.js";

describe("parseUninstallArgs", () => {
  it("returns all false with no arguments", () => {
    expect(parseUninstallArgs([])).toEqual({ purge: false, dryRun: false });
  });

  it("sets purge when --purge is passed", () => {
    const args = parseUninstallArgs(["--purge"]);
    expect(args.purge).toBe(true);
    expect(args.dryRun).toBe(false);
  });

  it("sets dryRun when --dry-run is passed", () => {
    const args = parseUninstallArgs(["--dry-run"]);
    expect(args.dryRun).toBe(true);
    expect(args.purge).toBe(false);
  });

  it("sets both flags together", () => {
    const args = parseUninstallArgs(["--purge", "--dry-run"]);
    expect(args).toEqual({ purge: true, dryRun: true });
  });

  it("throws HelpRequestedError for -h", () => {
    expect(() => parseUninstallArgs(["-h"])).toThrow(HelpRequestedError);
  });

  it("throws HelpRequestedError for --help", () => {
    expect(() => parseUninstallArgs(["--help"])).toThrow(HelpRequestedError);
  });

  it("throws Error with 'unknown argument' for unrecognised flag", () => {
    expect(() => parseUninstallArgs(["--bogus"])).toThrow(/unknown argument/);
  });

  it("throws Error with the unknown flag name in the message", () => {
    expect(() => parseUninstallArgs(["--unknown-flag"])).toThrow(/unknown-flag/);
  });
});

describe("formatLastRenderBanner", () => {
  it("returns empty when there is no cached render", () => {
    expect(formatLastRenderBanner(null)).toBe("");
  });

  it("returns empty when the cached render is the empty string", () => {
    expect(
      formatLastRenderBanner({
        version: RENDER_CACHE_VERSION,
        savedAt: "2026-05-13T22:00:00Z",
        rendered: "",
        meta: {},
      }),
    ).toBe("");
  });

  it("frames the cached render with a restore hint", () => {
    const banner = formatLastRenderBanner({
      version: RENDER_CACHE_VERSION,
      savedAt: "2026-05-13T22:00:00Z",
      rendered: "hello\n",
      meta: {},
    });
    expect(banner).toContain("Last statusline:");
    expect(banner).toContain("hello\n");
    expect(banner).toContain("2026-05-13T22:00:00Z");
    expect(banner).toContain("agentline install");
  });

  it("appends a trailing newline when the cached render lacks one", () => {
    const banner = formatLastRenderBanner({
      version: RENDER_CACHE_VERSION,
      savedAt: "2026-05-13T22:00:00Z",
      rendered: "no-trailing-newline",
      meta: {},
    });
    expect(banner).toContain("no-trailing-newline\n");
  });

  it("preserves SGR colour codes from the cached render", () => {
    const banner = formatLastRenderBanner({
      version: RENDER_CACHE_VERSION,
      savedAt: "2026-05-13T22:00:00Z",
      rendered: "\x1b[32mgreen\x1b[0m statusline\n",
      meta: {},
    });
    expect(banner).toContain("\x1b[32mgreen\x1b[0m statusline\n");
  });

  it("strips non-SGR escapes (OSC 52 clipboard, cursor moves, BEL) from a tampered cache", () => {
    const hostile = "safe \x1b]52;c;BASE64PAYLOAD\x07 then \x1b[2J cleared \x1b[H homed \x07bell\n";
    const banner = formatLastRenderBanner({
      version: RENDER_CACHE_VERSION,
      savedAt: "2026-05-13T22:00:00Z",
      rendered: hostile,
      meta: {},
    });
    expect(banner).not.toContain("\x1b]");
    expect(banner).not.toContain("\x1b[2J");
    expect(banner).not.toContain("\x1b[H");
    expect(banner).not.toContain("\x07");
    expect(banner).toContain("safe");
    expect(banner).toContain("cleared");
    expect(banner).toContain("homed");
  });
});
