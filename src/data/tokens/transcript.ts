/**
 * JSONL transcript reader with a process-wide cache (§O3).
 *
 * Cache key is `(transcriptPath, mtime, size)`. Entries are evicted
 * after 5 hours of wall-clock idle or when total parsed-events memory
 * crosses 32 MB, whichever first. Cache is sync and read-only — never
 * throws; a missing/unreadable transcript yields an empty event list
 * so the dependent widgets simply read zero.
 *
 * Each transcript line (per the host JSONL contract) is a JSON
 * object. We extract the subset every aggregator needs: usage tokens,
 * the timestamp, the model id at message time, the thinking-effort
 * tier, and a `compaction` marker. Anything else is ignored.
 */

import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";

import { isPlainObject } from "../../core/lib/object.js";

export interface TranscriptEvent {
  readonly timestamp: number;
  readonly model?: string;
  readonly effort?: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly compaction: boolean;
}

interface CacheEntry {
  readonly key: string;
  readonly events: readonly TranscriptEvent[];
  readonly bytes: number;
  readonly lastUsed: number;
}

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_TRANSCRIPT_BYTES = 16 * 1024 * 1024;

const cache: Map<string, CacheEntry> = new Map();
let totalBytes = 0;

export function readTranscript(
  transcriptPath: string | undefined,
  now: number,
): readonly TranscriptEvent[] {
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
      events: hit.events,
      bytes: hit.bytes,
      lastUsed: now,
    });
    return hit.events;
  }
  const events = parseFile(transcriptPath);
  const bytes = approxBytes(events);
  if (hit) totalBytes -= hit.bytes;
  cache.set(transcriptPath, { key, events, bytes, lastUsed: now });
  totalBytes += bytes;
  evictBySize();
  return events;
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
 * Tests can override via AGENTLINE_TRANSCRIPT_ROOT.
 */
function isPermittedTranscriptPath(p: string): boolean {
  const abs = resolve(p);
  if (abs.includes(`${sep}..${sep}`) || abs.endsWith(`${sep}..`)) return false;
  const override = process.env.AGENTLINE_TRANSCRIPT_ROOT;
  if (override) return abs.startsWith(`${resolve(override)}${sep}`) || abs === resolve(override);
  const home = homedir();
  if (!home) return true;
  const claudeDir = resolve(home, ".claude");
  return abs.startsWith(`${claudeDir}${sep}`);
}

function parseFile(path: string): readonly TranscriptEvent[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const events: TranscriptEvent[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const ev = toEvent(obj);
    if (ev) events.push(ev);
  }
  return Object.freeze(events);
}

function toEvent(obj: unknown): TranscriptEvent | null {
  if (!isPlainObject(obj)) return null;
  const ts = parseTimestamp(obj["timestamp"]);
  if (ts === null) return null;
  const compaction = obj["type"] === "compaction" || obj["compaction"] === true;
  const usage = extractUsage(obj);
  const model = obj["model"];
  const effort = obj["thinkingEffort"];
  return {
    timestamp: ts,
    model: typeof model === "string" ? model : undefined,
    effort: typeof effort === "string" ? effort : undefined,
    inputTokens: usage.input,
    outputTokens: usage.output,
    cachedTokens: usage.cached,
    compaction,
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

function approxBytes(events: readonly TranscriptEvent[]): number {
  return events.length * 96;
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
