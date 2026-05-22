import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearTranscriptCache,
  isPermittedTranscriptPath,
  readTranscriptRecords,
} from "./transcript.js";

const FIXED_NOW = new Date("2026-04-28T12:00:00Z").getTime();
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "agentline-transcript-"));
  /*
   * Tests use OS tmp dir, which is outside the default ~/.claude root
   * permitted by isPermittedTranscriptPath. Override for the test scope.
   * `vi.stubEnv` auto-restores on teardown so a thrown assertion can't
   * leak the override into sibling suites in the same worker.
   */
  vi.stubEnv("AGENTLINE_TRANSCRIPT_ROOT", tmp);
  clearTranscriptCache();
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function writeTranscript(filename: string, lines: unknown[]): string {
  const file = path.join(tmp, filename);
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return file;
}

describe("readTranscriptRecords", () => {
  it("returns [] for missing transcript path", () => {
    expect(readTranscriptRecords(path.join(tmp, "missing.jsonl"), FIXED_NOW)).toEqual([]);
  });

  it("returns [] when transcriptPath is undefined", () => {
    expect(readTranscriptRecords(undefined, FIXED_NOW)).toEqual([]);
  });

  it("parses input/output/cached tokens", () => {
    const file = writeTranscript("a.jsonl", [
      {
        timestamp: "2026-05-01T00:00:00Z",
        message: { usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5 } },
        model: "claude-opus-4-7",
      },
    ]);
    const records = readTranscriptRecords(file, FIXED_NOW);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
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
    const records = readTranscriptRecords(file, FIXED_NOW);
    expect(records[0]?.cachedTokens).toBe(10);
  });

  it("ignores malformed lines silently", () => {
    const file = path.join(tmp, "c.jsonl");
    writeFileSync(file, '{"valid": true, "timestamp": "2026-05-01T00:00:00Z"}\n{not json\n\n');
    const records = readTranscriptRecords(file, FIXED_NOW);
    expect(records).toHaveLength(1);
  });

  it("ignores lines without a parseable timestamp", () => {
    const file = writeTranscript("d.jsonl", [
      { message: { usage: { input_tokens: 99 } } },
      { timestamp: "2026-05-01T00:00:00Z", message: { usage: { input_tokens: 5 } } },
    ]);
    const records = readTranscriptRecords(file, FIXED_NOW);
    expect(records).toHaveLength(1);
  });

  it("treats type=compaction as a compaction event", () => {
    const file = writeTranscript("e.jsonl", [
      { timestamp: "2026-05-01T00:00:00Z", type: "compaction" },
    ]);
    const records = readTranscriptRecords(file, FIXED_NOW);
    expect(records[0]?.compaction).toBe(true);
  });

  it("caches subsequent reads with identical (mtime, size)", () => {
    const file = writeTranscript("cache.jsonl", [
      { timestamp: "2026-05-01T00:00:00Z", message: { usage: { input_tokens: 1 } } },
    ]);
    const first = readTranscriptRecords(file, FIXED_NOW);
    const second = readTranscriptRecords(file, FIXED_NOW);
    expect(second).toBe(first);
  });

  it("invalidates cache when the file changes", () => {
    const file = writeTranscript("change.jsonl", [
      { timestamp: "2026-05-01T00:00:00Z", message: { usage: { input_tokens: 1 } } },
    ]);
    const before = readTranscriptRecords(file, FIXED_NOW);
    writeFileSync(
      file,
      JSON.stringify({
        timestamp: "2026-05-01T00:00:01Z",
        message: { usage: { input_tokens: 2 } },
      }) +
        "\n" +
        JSON.stringify({
          timestamp: "2026-05-01T00:00:02Z",
          message: { usage: { input_tokens: 3 } },
        }) +
        "\n",
    );
    const after = readTranscriptRecords(file, FIXED_NOW + 1000);
    expect(after).not.toBe(before);
    expect(after).toHaveLength(2);
  });

  it("evicts an entry whose lastUsed is older than 5 hours", () => {
    const file = writeTranscript("evict.jsonl", [
      { timestamp: "2026-05-01T00:00:00Z", message: { usage: { input_tokens: 1 } } },
    ]);
    const first = readTranscriptRecords(file, FIXED_NOW);
    /*
     * Advance well past the eviction threshold; the next read should
     * re-parse the file (different reference) instead of returning the
     * cached records array.
     */
    const second = readTranscriptRecords(file, FIXED_NOW + FIVE_HOURS_MS + 1);
    expect(second).not.toBe(first);
    expect(second).toHaveLength(1);
  });

  it("rejects paths outside the permitted transcript root", () => {
    // Point the override at a sibling root so files in `tmp` are out of bounds.
    const sibling = mkdtempSync(path.join(os.tmpdir(), "agentline-sibling-"));
    vi.stubEnv("AGENTLINE_TRANSCRIPT_ROOT", sibling);
    try {
      const outside = writeTranscript("outside.jsonl", [{ timestamp: "2026-05-01T00:00:00Z" }]);
      expect(readTranscriptRecords(outside, FIXED_NOW)).toEqual([]);
    } finally {
      rmSync(sibling, { recursive: true, force: true });
      vi.stubEnv("AGENTLINE_TRANSCRIPT_ROOT", tmp);
    }
  });
});

describe("readTranscriptRecords — plan_mode attachments", () => {
  it("extracts planFilePath and slug from a plan_mode attachment line", () => {
    const file = writeTranscript("plan.jsonl", [
      {
        type: "attachment",
        timestamp: "2026-05-01T00:00:00Z",
        slug: "tender-yawning-river",
        attachment: {
          type: "plan_mode",
          isSubAgent: false,
          planFilePath: "/p/plans/tender-yawning-river.md",
        },
      },
    ]);
    const records = readTranscriptRecords(file, FIXED_NOW);
    expect(records[0]?.planAttachment).toEqual({
      planFilePath: "/p/plans/tender-yawning-river.md",
      slug: "tender-yawning-river",
      isSubAgent: false,
    });
  });

  it("marks subagent plan attachments with isSubAgent: true", () => {
    const file = writeTranscript("sub.jsonl", [
      {
        type: "attachment",
        timestamp: "2026-05-01T00:00:00Z",
        attachment: {
          type: "plan_mode",
          isSubAgent: true,
          planFilePath: "/p/plans/sub.md",
        },
      },
    ]);
    const records = readTranscriptRecords(file, FIXED_NOW);
    expect(records[0]?.planAttachment?.isSubAgent).toBe(true);
    expect(records[0]?.planAttachment?.slug).toBeUndefined();
  });

  it("leaves planAttachment absent on non-plan-mode lines", () => {
    const file = writeTranscript("mixed.jsonl", [
      { timestamp: "2026-05-01T00:00:00Z", type: "attachment", attachment: { type: "other" } },
      { timestamp: "2026-05-01T00:00:01Z", message: { usage: { input_tokens: 1 } } },
    ]);
    const records = readTranscriptRecords(file, FIXED_NOW);
    expect(records).toHaveLength(2);
    expect(records[0]?.planAttachment).toBeUndefined();
    expect(records[1]?.planAttachment).toBeUndefined();
  });

  it("ignores a plan_mode attachment with no planFilePath", () => {
    const file = writeTranscript("nopath.jsonl", [
      {
        timestamp: "2026-05-01T00:00:00Z",
        type: "attachment",
        attachment: { type: "plan_mode", isSubAgent: false },
      },
    ]);
    const records = readTranscriptRecords(file, FIXED_NOW);
    expect(records[0]?.planAttachment).toBeUndefined();
  });
});

describe("isPermittedTranscriptPath", () => {
  it("rejects a path outside the permitted root", () => {
    expect(isPermittedTranscriptPath("/etc/shadow")).toBe(false);
  });

  it("accepts a path under the test-only override root", () => {
    expect(isPermittedTranscriptPath(path.join(tmp, "x.jsonl"))).toBe(true);
  });
});
