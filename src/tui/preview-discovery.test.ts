import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverLatestTranscript } from "./preview-discovery.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "agentline-discovery-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Write a transcript and stamp its mtime (seconds since epoch). */
function writeTranscript(dir: string, name: string, lines: unknown[], mtimeSec: number): string {
  const projectDir = path.join(root, "projects", dir);
  mkdirSync(projectDir, { recursive: true });
  const file = path.join(projectDir, name);
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  utimesSync(file, mtimeSec, mtimeSec);
  return file;
}

const env = (): NodeJS.ProcessEnv => ({ CLAUDE_CONFIG_DIR: root });

describe("discoverLatestTranscript", () => {
  it("returns null when there is no projects dir", () => {
    expect(discoverLatestTranscript({ env: env() })).toBeNull();
  });

  it("picks the newest transcript by mtime across project dirs", () => {
    writeTranscript(
      "-Users-me-old",
      "11111111-1111-1111-1111-111111111111.jsonl",
      [{ type: "system", cwd: "/proj/old", version: "2.0.1" }],
      1_000,
    );
    const newest = writeTranscript(
      "-Users-me-new",
      "22222222-2222-2222-2222-222222222222.jsonl",
      [
        { type: "system", cwd: "/proj/new", version: "2.0.9" },
        { type: "assistant", message: { model: "claude-sonnet-4-6" } },
        { type: "assistant", message: { model: "claude-opus-4-7" } },
      ],
      9_000,
    );
    const payload = discoverLatestTranscript({ env: env() });
    expect(payload).not.toBeNull();
    expect(payload?.transcriptPath).toBe(newest);
    expect(payload?.cwd).toBe("/proj/new");
    expect(payload?.version).toBe("2.0.9");
    // sessionId defaults to the filename stem.
    expect(payload?.sessionId).toBe("22222222-2222-2222-2222-222222222222");
    // model is the LAST message.model seen.
    expect(payload?.model).toBe("claude-opus-4-7");
  });

  it("falls through to the next transcript when the newest has no cwd", () => {
    writeTranscript(
      "-Users-me-good",
      "good.jsonl",
      [{ type: "system", cwd: "/proj/good" }],
      1_000,
    );
    writeTranscript("-Users-me-bad", "bad.jsonl", [{ type: "last-prompt" }], 9_000);
    const payload = discoverLatestTranscript({ env: env() });
    expect(payload?.cwd).toBe("/proj/good");
  });

  it("omits model when no assistant line carries one", () => {
    writeTranscript("-d", "s.jsonl", [{ type: "user", cwd: "/x" }], 1_000);
    const payload = discoverLatestTranscript({ env: env() });
    expect(payload?.cwd).toBe("/x");
    expect(payload?.model).toBeUndefined();
  });

  it("skips a non-JSON / empty transcript and returns null", () => {
    const projectDir = path.join(root, "projects", "-d");
    mkdirSync(projectDir, { recursive: true });
    const file = path.join(projectDir, "x.jsonl");
    writeFileSync(file, "not json\n\n{bad}\n");
    utimesSync(file, 1_000, 1_000);
    expect(discoverLatestTranscript({ env: env() })).toBeNull();
  });

  it("honours the homedir fallback when CLAUDE_CONFIG_DIR is unset", () => {
    // resolveClaudeDir → <homedir>/.claude
    const claude = path.join(root, ".claude");
    const projectDir = path.join(claude, "projects", "-p");
    mkdirSync(projectDir, { recursive: true });
    const file = path.join(projectDir, "h.jsonl");
    writeFileSync(file, JSON.stringify({ type: "system", cwd: "/srv/me" }) + "\n");
    utimesSync(file, 5_000, 5_000);
    const payload = discoverLatestTranscript({ env: {}, homedir: root });
    expect(payload?.cwd).toBe("/srv/me");
    expect(payload?.transcriptPath).toBe(file);
  });
});
