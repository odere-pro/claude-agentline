import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearTranscriptCache, readTranscript } from "./transcript.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "agentline-transcript-"));
  clearTranscriptCache();
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function writeTranscript(filename: string, lines: unknown[]): string {
  const file = path.join(tmp, filename);
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return file;
}

describe("readTranscript", () => {
  it("returns [] for missing transcript path", () => {
    expect(readTranscript(path.join(tmp, "missing.jsonl"), 0)).toEqual([]);
  });

  it("returns [] when transcriptPath is undefined", () => {
    expect(readTranscript(undefined, 0)).toEqual([]);
  });

  it("parses input/output/cached tokens", () => {
    const file = writeTranscript("a.jsonl", [
      {
        timestamp: "2026-05-01T00:00:00Z",
        message: { usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5 } },
        model: "claude-opus-4-7",
      },
    ]);
    const events = readTranscript(file, Date.now());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      inputTokens: 10,
      outputTokens: 20,
      cachedTokens: 5,
      model: "claude-opus-4-7",
    });
  });

  it("aggregates cache_read and cache_creation into cached", () => {
    const file = writeTranscript("b.jsonl", [
      {
        timestamp: "2026-05-01T00:00:00Z",
        message: { usage: { cache_read_input_tokens: 3, cache_creation_input_tokens: 7 } },
      },
    ]);
    const events = readTranscript(file, Date.now());
    expect(events[0]?.cachedTokens).toBe(10);
  });

  it("ignores malformed lines silently", () => {
    const file = path.join(tmp, "c.jsonl");
    writeFileSync(file, '{"valid": true, "timestamp": "2026-05-01T00:00:00Z"}\n{not json\n\n');
    const events = readTranscript(file, Date.now());
    expect(events).toHaveLength(1);
  });

  it("ignores lines without a parseable timestamp", () => {
    const file = writeTranscript("d.jsonl", [
      { message: { usage: { input_tokens: 99 } } },
      { timestamp: "2026-05-01T00:00:00Z", message: { usage: { input_tokens: 5 } } },
    ]);
    const events = readTranscript(file, Date.now());
    expect(events).toHaveLength(1);
  });

  it("treats type=compaction as a compaction event", () => {
    const file = writeTranscript("e.jsonl", [
      { timestamp: "2026-05-01T00:00:00Z", type: "compaction" },
    ]);
    const events = readTranscript(file, Date.now());
    expect(events[0]?.compaction).toBe(true);
  });

  it("caches subsequent reads with identical (mtime, size)", () => {
    const file = writeTranscript("cache.jsonl", [
      { timestamp: "2026-05-01T00:00:00Z", message: { usage: { input_tokens: 1 } } },
    ]);
    const first = readTranscript(file, Date.now());
    const second = readTranscript(file, Date.now());
    expect(second).toBe(first);
  });

  it("invalidates cache when the file changes", () => {
    const file = writeTranscript("change.jsonl", [
      { timestamp: "2026-05-01T00:00:00Z", message: { usage: { input_tokens: 1 } } },
    ]);
    const before = readTranscript(file, Date.now());
    writeFileSync(
      file,
      JSON.stringify({ timestamp: "2026-05-01T00:00:01Z", message: { usage: { input_tokens: 2 } } }) +
        "\n" +
        JSON.stringify({ timestamp: "2026-05-01T00:00:02Z", message: { usage: { input_tokens: 3 } } }) +
        "\n",
    );
    const after = readTranscript(file, Date.now() + 1000);
    expect(after).not.toBe(before);
    expect(after).toHaveLength(2);
  });
});
