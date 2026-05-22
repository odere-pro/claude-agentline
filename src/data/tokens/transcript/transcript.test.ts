import { describe, expect, it } from "vitest";

import {
  readTranscriptRecords,
  MAX_TRANSCRIPT_BYTES as CORE_MAX,
} from "../../../core/lib/transcript/transcript.js";

import { readTranscript, MAX_TRANSCRIPT_BYTES } from "./transcript.js";

/*
 * The reader's behaviour (parsing, caching, sandbox, eviction) is tested
 * in src/core/lib/transcript/transcript.test.ts. This module is a thin
 * adapter, so it only asserts the delegation + re-export wiring.
 */
describe("tokens transcript adapter", () => {
  it("readTranscript delegates to the shared core reader", () => {
    expect(readTranscript).toBe(readTranscriptRecords);
  });

  it("re-exports the core size cap", () => {
    expect(MAX_TRANSCRIPT_BYTES).toBe(CORE_MAX);
  });
});
