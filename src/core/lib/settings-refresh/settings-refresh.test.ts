/**
 * `syncRefreshInterval` — write contract against the host settings file
 * (Claude Code settings under `<home>/.claude/settings.json`). Tested
 * with a tmp `$HOME`-shaped directory so the real settings file is never
 * touched.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { syncRefreshInterval } from "./settings-refresh.js";

let home: string;

function settingsFile(): string {
  return join(home, ".claude", "settings.json");
}

function writeSettings(content: unknown): void {
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify(content, null, 2), { mode: 0o600 });
}

function readSettings(): Record<string, unknown> {
  return JSON.parse(readFileSync(settingsFile(), "utf8")) as Record<string, unknown>;
}

const wired = (extra: Record<string, unknown> = {}) => ({
  command: "npx -y @odere-pro/agentline render",
  ...extra,
});

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "agentline-srf-"));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe("syncRefreshInterval", () => {
  it("returns `not-wired` when settings.json is absent", async () => {
    const result = await syncRefreshInterval(home, 5);
    expect(result.kind).toBe("not-wired");
  });

  it("returns `not-wired` when settings.json exists but has no statusLine", async () => {
    writeSettings({ theme: "dark" });
    const result = await syncRefreshInterval(home, 5);
    expect(result.kind).toBe("not-wired");
  });

  it("returns `not-wired` when statusLine points at a foreign command", async () => {
    writeSettings({ statusLine: { command: "/usr/local/bin/foreign" } });
    const result = await syncRefreshInterval(home, 5);
    expect(result.kind).toBe("not-wired");
  });

  it("returns `not-wired` when settings.json is corrupt JSON", async () => {
    mkdirSync(join(home, ".claude"), { recursive: true });
    writeFileSync(settingsFile(), "{not-json", { mode: 0o600 });
    const result = await syncRefreshInterval(home, 5);
    expect(result.kind).toBe("not-wired");
  });

  it("writes refreshInterval when seconds >= 1 and the value differs", async () => {
    writeSettings({ statusLine: wired() });
    const result = await syncRefreshInterval(home, 5);
    expect(result.kind).toBe("written");
    if (result.kind === "written") {
      expect(result.value).toBe(5);
    }
    const after = readSettings();
    const sl = after["statusLine"] as Record<string, unknown>;
    expect(sl["refreshInterval"]).toBe(5);
    // Other statusLine keys (command) and other top-level keys survive.
    expect(sl["command"]).toBe("npx -y @odere-pro/agentline render");
  });

  it("returns `unchanged` when seconds >= 1 and the value already matches", async () => {
    writeSettings({ statusLine: wired({ refreshInterval: 5 }) });
    const result = await syncRefreshInterval(home, 5);
    expect(result.kind).toBe("unchanged");
  });

  it("removes refreshInterval when seconds === 0 and the field is present", async () => {
    writeSettings({ statusLine: wired({ refreshInterval: 5 }) });
    const result = await syncRefreshInterval(home, 0);
    expect(result.kind).toBe("removed");
    const after = readSettings();
    const sl = after["statusLine"] as Record<string, unknown>;
    expect(sl["refreshInterval"]).toBeUndefined();
    expect(sl["command"]).toBe("npx -y @odere-pro/agentline render");
  });

  it("returns `unchanged` when seconds === 0 and the field is already absent", async () => {
    writeSettings({ statusLine: wired() });
    const result = await syncRefreshInterval(home, 0);
    expect(result.kind).toBe("unchanged");
  });

  it("preserves unrelated top-level keys on write", async () => {
    writeSettings({
      theme: "dark",
      statusLine: wired(),
      hooks: { PostToolUse: [] },
    });
    await syncRefreshInterval(home, 7);
    const after = readSettings();
    expect(after["theme"]).toBe("dark");
    expect(after["hooks"]).toEqual({ PostToolUse: [] });
    const sl = after["statusLine"] as Record<string, unknown>;
    expect(sl["refreshInterval"]).toBe(7);
  });
});
