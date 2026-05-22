/**
 * Token-facing transcript adapter.
 *
 * The JSONL read/parse/cache lives in `core/lib/transcript` so the
 * per-session plan resolver shares the same single read per tick (the
 * file is read and parsed once even though `data/tokens` and
 * `data/session` both consume it). This module keeps the token-facing
 * names and re-exports the size cap + cache reset other modules rely on.
 *
 * Widgets MUST read from `ctx.tokens` and never touch the filesystem
 * during `render()` (§1.2 N3).
 */

import {
  readTranscriptRecords,
  type TranscriptRecord,
} from "../../../core/lib/transcript/transcript.js";

export {
  clearTranscriptCache,
  MAX_TRANSCRIPT_BYTES,
} from "../../../core/lib/transcript/transcript.js";

/**
 * Token-relevant projection of a transcript line. The optional
 * `planAttachment` field is ignored by the token aggregators.
 */
export type TranscriptEvent = TranscriptRecord;

/** Read the parsed transcript records (shared, cached) for token math. */
export const readTranscript = readTranscriptRecords;
