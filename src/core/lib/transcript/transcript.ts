/**
 * Shared JSONL transcript reader with a process-wide cache.
 *
 * One read per `(transcriptPath, mtime, size)` serves every consumer in a
 * tick: the token aggregators (`src/data/tokens/`) and the per-session
 * plan resolver (`src/data/session/plan/`) both fold the same parsed
 * record list, so the file is read and parsed exactly once even though
 * two `data` sub-groups depend on it (§1.2 N3 cold-start budget). Lives in
 * `core` so both importers stay within the allowed `data → core` direction
 * (gate-25).
 *
 * Cache key is `(transcriptPath, mtime, size)`. Entries are evicted after
 * 5 hours of wall-clock idle or when total parsed-record memory crosses
 * 32 MB, whichever first. The reader is sync and read-only — never throws;
 * a missing/unreadable transcript yields an empty list so dependent
 * widgets simply read nothing.
 *
 * Each transcript line (per the host JSONL contract) is a JSON object. We
 * project the subset consumers need: usage tokens, the timestamp, the
 * model id and thinking-effort tier at message time, a `compaction`
 * marker, and — on plan-mode attachment lines — the active plan file.
 * Anything else is ignored.
 */

import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";

import { isPlainObject } from "../object/object.js";
import { FIVE_HOURS_MS } from "../time.js";

/**
 * Read cap shared with the editor's transcript-discovery path so neither
 * side slurps a multi-GB JSONL into memory. This module is the canonical
 * reader; `preview-discovery.ts` mirrors it via a re-export.
 */
export const MAX_TRANSCRIPT_BYTES = 16 * 1024 * 1024;

/** The active plan referenced by a `type:"attachment"` + `plan_mode` line. */
export interface PlanAttachment {
  readonly planFilePath: string;
  readonly slug?: string;
  /** True for a subagent / sidechain plan; the top-level session ignores these. */
  readonly isSubAgent: boolean;
}

export interface TranscriptRecord {
  readonly timestamp: number;
  readonly model?: string;
  readonly effort?: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly compaction: boolean;
  /** Present only on a plan-mode attachment line. */
  readonly planAttachment?: PlanAttachment;
}

interface CacheEntry {
  readonly key: string;
  readonly records: readonly TranscriptRecord[];
  readonly bytes: number;
  readonly lastUsed: number;
}

const MAX_CACHE_BYTES = 32 * 1024 * 1024;

const cache: Map<string, CacheEntry> = new Map();
let totalBytes = 0;

export function readTranscriptRecords(
  transcriptPath: string | undefined,
  now: number,
): readonly TranscriptRecord[] {
  if (!transcriptPath) return [];
  if (!isPermittedTranscriptPath(transcriptPath)) return [];
  let stat;
  try {
    stat = statSync(transcriptPath);
  } catch {
    return [];
  }
  /*
   * Bound the read so a stdin payload pointing at a multi-GB file or a
   * /dev/zero symlink can't OOM the render path.
   */
  if (stat.size > MAX_TRANSCRIPT_BYTES) return [];
  const key = `${transcriptPath}:${stat.mtimeMs}:${stat.size}`;
  evictExpired(now);
  const hit = cache.get(transcriptPath);
  if (hit && hit.key === key) {
    cache.set(transcriptPath, {
      key: hit.key,
      records: hit.records,
      bytes: hit.bytes,
      lastUsed: now,
    });
    return hit.records;
  }
  const records = parseFile(transcriptPath);
  const bytes = approxBytes(records);
  if (hit) totalBytes -= hit.bytes;
  cache.set(transcriptPath, { key, records, bytes, lastUsed: now });
  totalBytes += bytes;
  evictBySize();
  return records;
}

export function clearTranscriptCache(): void {
  cache.clear();
  totalBytes = 0;
}

/*
 * Defence-in-depth: stdin is supplied by Claude Code and the payload is
 * trusted, but the JSONL reader will gladly parse any path it's handed
 * (`/etc/shadow` if readable). Constrain to a known transcript root so a
 * malformed payload can't turn this into an arbitrary-path read primitive.
 *
 * `AGENTLINE_TRANSCRIPT_ROOT` is a TEST-ONLY seam — honoured only when
 * `NODE_ENV=test`. At runtime the override is ignored so a process that
 * can set environment variables on the agentline render (parent shell,
 * a sibling tool) cannot broaden the sandbox to `/` and weaponise the
 * stdin `transcript_path` into an arbitrary-file read.
 */
export function isPermittedTranscriptPath(p: string): boolean {
  const abs = resolve(p);
  if (abs.includes(`${sep}..${sep}`) || abs.endsWith(`${sep}..`)) return false;
  if (process.env.NODE_ENV === "test") {
    const override = process.env.AGENTLINE_TRANSCRIPT_ROOT;
    if (override) return abs.startsWith(`${resolve(override)}${sep}`) || abs === resolve(override);
  }
  const home = homedir();
  if (!home) return true;
  const claudeDir = resolve(home, ".claude");
  return abs.startsWith(`${claudeDir}${sep}`);
}

function parseFile(path: string): readonly TranscriptRecord[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const records: TranscriptRecord[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const record = toRecord(obj);
    if (record) records.push(record);
  }
  return Object.freeze(records);
}

function toRecord(obj: unknown): TranscriptRecord | null {
  if (!isPlainObject(obj)) return null;
  const ts = parseTimestamp(obj["timestamp"]);
  if (ts === null) return null;
  const compaction = obj["type"] === "compaction" || obj["compaction"] === true;
  const usage = extractUsage(obj);
  const model = obj["model"];
  const effort = obj["thinkingEffort"];
  const planAttachment = extractPlanAttachment(obj);
  return {
    timestamp: ts,
    model: typeof model === "string" ? model : undefined,
    effort: typeof effort === "string" ? effort : undefined,
    inputTokens: usage.input,
    outputTokens: usage.output,
    cachedTokens: usage.cached,
    compaction,
    ...(planAttachment ? { planAttachment } : {}),
  };
}

/**
 * Extract the plan file from a `type:"attachment"` line whose
 * `attachment.type` is `"plan_mode"`. The slug (the plan's display name)
 * is carried at the line's top level alongside the attachment.
 */
function extractPlanAttachment(o: Record<string, unknown>): PlanAttachment | null {
  if (o["type"] !== "attachment") return null;
  const attachment = o["attachment"];
  if (!isPlainObject(attachment)) return null;
  if (attachment["type"] !== "plan_mode") return null;
  const planFilePath = attachment["planFilePath"];
  if (typeof planFilePath !== "string" || planFilePath === "") return null;
  const slug = o["slug"];
  return {
    planFilePath,
    ...(typeof slug === "string" && slug !== "" ? { slug } : {}),
    isSubAgent: attachment["isSubAgent"] === true,
  };
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Date.parse(value);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

interface UsageTotals {
  input: number;
  output: number;
  cached: number;
}

function extractUsage(o: Record<string, unknown>): UsageTotals {
  const message = o["message"];
  if (isPlainObject(message)) {
    const usage = message["usage"];
    if (isPlainObject(usage)) return readUsage(usage);
  }
  const usage = o["usage"];
  if (isPlainObject(usage)) return readUsage(usage);
  return { input: 0, output: 0, cached: 0 };
}

function readUsage(u: Record<string, unknown>): UsageTotals {
  return {
    input: numberOrZero(u["input_tokens"]),
    output: numberOrZero(u["output_tokens"]),
    cached:
      numberOrZero(u["cache_read_input_tokens"]) + numberOrZero(u["cache_creation_input_tokens"]),
  };
}

function numberOrZero(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

function approxBytes(records: readonly TranscriptRecord[]): number {
  return records.length * 96;
}

function evictExpired(now: number): void {
  for (const [key, entry] of cache) {
    if (now - entry.lastUsed > FIVE_HOURS_MS) {
      cache.delete(key);
      totalBytes -= entry.bytes;
    }
  }
}

function evictBySize(): void {
  if (totalBytes <= MAX_CACHE_BYTES) return;
  const sorted = Array.from(cache.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [key, entry] of sorted) {
    if (totalBytes <= MAX_CACHE_BYTES) break;
    cache.delete(key);
    totalBytes -= entry.bytes;
  }
}
