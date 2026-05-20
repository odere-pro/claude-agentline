/**
 * Property-based fuzzing of the JSONL transcript reader.
 *
 * The transcript path comes from the (trusted) stdin payload, but its
 * *contents* are an arbitrary on-disk file. These properties assert the
 * reader never throws on malformed JSONL and only ever emits well-formed,
 * non-negative-numeric events — the contract every token aggregator relies
 * on downstream.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearTranscriptCache,
  readTranscript,
} from "../../src/data/tokens/transcript/transcript.js";

const FIXED_NOW = new Date("2026-04-28T12:00:00Z").getTime();

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "agentline-fuzz-transcript-"));
  // The reader sandboxes paths under ~/.claude unless this TEST-ONLY
  // override (honoured only when NODE_ENV=test) widens the root.
  vi.stubEnv("AGENTLINE_TRANSCRIPT_ROOT", tmp);
  clearTranscriptCache();
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function writeRaw(filename: string, contents: string): string {
  const file = path.join(tmp, filename);
  writeFileSync(file, contents);
  return file;
}

describe("fuzz: readTranscript", () => {
  it("never throws and emits well-formed events for arbitrary JSONL lines", () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 50 }), (lines) => {
        const file = writeRaw("fuzz.jsonl", lines.join("\n"));
        const events = readTranscript(file, FIXED_NOW);
        expect(Array.isArray(events)).toBe(true);
        for (const ev of events) {
          expect(typeof ev.timestamp).toBe("number");
          expect(Number.isFinite(ev.inputTokens)).toBe(true);
          expect(ev.inputTokens).toBeGreaterThanOrEqual(0);
          expect(ev.outputTokens).toBeGreaterThanOrEqual(0);
          expect(ev.cachedTokens).toBeGreaterThanOrEqual(0);
          expect(typeof ev.compaction).toBe("boolean");
        }
      }),
    );
  });

  it("never throws for arbitrary JSON objects serialised as JSONL", () => {
    fc.assert(
      fc.property(fc.array(fc.object(), { maxLength: 50 }), (objs) => {
        const file = writeRaw("fuzz-json.jsonl", objs.map((o) => JSON.stringify(o)).join("\n"));
        const events = readTranscript(file, FIXED_NOW);
        expect(Array.isArray(events)).toBe(true);
      }),
    );
  });
});
