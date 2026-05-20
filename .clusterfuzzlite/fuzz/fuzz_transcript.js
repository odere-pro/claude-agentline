// Jazzer.js fuzz target: JSONL transcript reader.
// Mirrors tests/fuzz/transcript-parser.fuzz.test.ts. The data buffer is
// written to a sandboxed temp file (the reader sandboxes paths under a
// permitted root) and parsed; the reader must never throw and every event
// must be well-formed.

const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert");

const { readTranscript, clearTranscriptCache } = require("./bundle.cjs");

// The reader honours AGENTLINE_TRANSCRIPT_ROOT only when NODE_ENV=test.
process.env.NODE_ENV = "test";
const now = new Date("2026-04-28T12:00:00Z").getTime();

/**
 * @param {Buffer} data
 */
module.exports.fuzz = function (data) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agentline-fuzz-transcript-"));
  process.env.AGENTLINE_TRANSCRIPT_ROOT = dir;
  const file = path.join(dir, "fuzz.jsonl");
  try {
    writeFileSync(file, data);
    clearTranscriptCache();
    const events = readTranscript(file, now);
    assert(Array.isArray(events), "events must be an array");
    for (const ev of events) {
      assert(typeof ev.timestamp === "number", "timestamp must be a number");
      assert(ev.inputTokens >= 0, "inputTokens must be non-negative");
      assert(ev.outputTokens >= 0, "outputTokens must be non-negative");
      assert(ev.cachedTokens >= 0, "cachedTokens must be non-negative");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
