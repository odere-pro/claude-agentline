/**
 * Claude Code statusline stdin contract parser.
 *
 * The bin reads stdin until EOF or 256 KB, whichever first (§8.1).
 * Unknown fields are preserved untouched on `raw`. A malformed payload
 * produces a structured error the caller can render as an ASCII fallback.
 *
 * Two responsibilities, intentionally split:
 *
 *   - `readStdinPayload` — the I/O step (read bounded bytes, JSON.parse,
 *     reject non-object payloads).
 *   - `adaptStatuslinePayload` — the pure adapter at the external→internal
 *     seam (the only place that knows the Claude Code statusline contract
 *     field names). Forward-compatibility absorptions for contract drift
 *     live here.
 */

import { isPlainObject, pickString } from "../lib/object.js";

const MAX_PAYLOAD_BYTES = 256 * 1024;

export interface StdinPayload {
  /** Original parsed JSON, fields untouched. */
  raw: Record<string, unknown>;
  /** True when the payload was clipped at MAX_PAYLOAD_BYTES. */
  truncated: boolean;
  /** Convenience accessors for known fields; all optional. */
  model?: string;
  /**
   * Claude Code's user-facing label for the model when sent as
   * `model: { display_name }` (e.g. `"Opus 4.7 (1M context)"`). Widgets
   * that want a human-readable name without doing their own id→label
   * mapping read this first; falls back to `model` and then to the
   * widget's own table.
   */
  modelDisplayName?: string;
  version?: string;
  /**
   * Known values at the time of writing: `"default"`, `"explanatory"`,
   * `"learning"`. Typed as `string` for forward-compat — callers that
   * need exhaustive handling should use `pickEnum` from `lib/object.ts`
   * against an explicit allow-list at their own boundary.
   */
  outputStyle?: string;
  sessionId?: string;
  sessionName?: string;
  cwd?: string;
  /**
   * Known values: `"low"`, `"medium"`, `"high"`, `"xhigh"`. Typed as
   * `string` so the `thinking-effort` widget can pass an unknown
   * future level through uncoloured rather than hide it. Consumers
   * that need a colour role or bucketing key narrow it themselves
   * (see `widgets/session/thinking-effort.ts`).
   */
  thinkingEffort?: string;
  /**
   * Known values: `"normal"`, `"insert"`, `"visual"`, `"replace"`.
   * Same forward-compat reasoning as `thinkingEffort`.
   */
  vimMode?: string;
  transcriptPath?: string;
  /**
   * Current-prompt context window snapshot Claude Code reports. The
   * `context-percentage` / `context-bar` widgets read this directly so
   * the value reflects the CURRENT turn's window usage (what the user
   * sees in Claude Code) instead of a cumulative session sum, which can
   * exceed the model's window many times over.
   *
   *   - `usedTokens`    `current_usage.input_tokens + cache_read + cache_creation`.
   *   - `windowSize`    `context_window_size` (the model's window).
   *   - `usedPercentage` `used_percentage` — Claude Code's pre-computed ratio.
   *
   * Any combination may be missing on older Claude Code versions; the
   * widgets handle each independently.
   */
  contextWindow?: {
    readonly usedTokens?: number;
    readonly windowSize?: number;
    readonly usedPercentage?: number;
  };
  /**
   * Server-side usage-limit snapshot Claude Code reports in its
   * `rate_limits` block — the same numbers shown on the host's `/usage`
   * screen. The `session-weekly-usage` widget reads this directly so
   * the value agrees with the host instead of being re-derived from
   * transcript tokens.
   *
   *   - `fiveHour`  → the current-session (5-hour) window.
   *   - `sevenDay`  → the weekly (7-day) window.
   *   - `usedPercentage` `used_percentage` — host's pre-computed 0–100 ratio.
   *   - `resetsAt`       `resets_at` — Unix epoch **seconds** of the next reset.
   *
   * Absent on older Claude Code versions; each window/field is handled
   * independently so a partial block still surfaces what it can.
   */
  rateLimits?: {
    readonly fiveHour?: { readonly usedPercentage?: number; readonly resetsAt?: number };
    readonly sevenDay?: { readonly usedPercentage?: number; readonly resetsAt?: number };
  };
}

export class StdinParseError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StdinParseError";
  }
}

/**
 * Pure adapter: Claude Code statusline JSON → internal `StdinPayload`.
 *
 * Exported so consumers that already have parsed JSON (tests, future
 * cache replay, contract-drift shims) can hit the seam directly without
 * routing through stdin I/O.
 *
 * Claude Code's contract uses snake_case keys and nests several values
 * one level deep:
 *
 *   - `model`         → `{ id, display_name }`  → keep `id`
 *   - `output_style`  → `{ name }`              → keep `name`
 *   - `effort`        → `{ level }`             → keep `level`
 *   - `workspace`     → `{ current_dir, … }`    → fallback for `cwd`
 *
 * The adapter normalises both shapes (and accepts a flat-string `model`
 * for back-compat with the older docs), so widgets read a single
 * camelCase, flat-string surface.
 */
export function adaptStatuslinePayload(
  raw: Record<string, unknown>,
  opts: { truncated?: boolean } = {},
): StdinPayload {
  const modelBlock = isPlainObject(raw["model"]) ? raw["model"] : undefined;
  const outputStyleBlock = isPlainObject(raw["output_style"]) ? raw["output_style"] : undefined;
  const effortBlock = isPlainObject(raw["effort"]) ? raw["effort"] : undefined;
  const workspaceBlock = isPlainObject(raw["workspace"]) ? raw["workspace"] : undefined;
  const contextWindow = adaptContextWindow(raw["context_window"]);
  const rateLimits = adaptRateLimits(raw["rate_limits"]);
  return {
    raw,
    truncated: opts.truncated ?? false,
    model: pickString(modelBlock, "id") ?? pickString(raw, "model"),
    modelDisplayName: pickString(modelBlock, "display_name"),
    version: pickString(raw, "version"),
    outputStyle: pickString(outputStyleBlock, "name") ?? pickString(raw, "output_style"),
    sessionId: pickString(raw, "session_id"),
    sessionName: pickString(raw, "session_name"),
    cwd: pickString(raw, "cwd") ?? pickString(workspaceBlock, "current_dir"),
    thinkingEffort: pickString(effortBlock, "level"),
    vimMode: pickString(raw, "vim_mode"),
    transcriptPath: pickString(raw, "transcript_path"),
    ...(contextWindow ? { contextWindow } : {}),
    ...(rateLimits ? { rateLimits } : {}),
  };
}

function pickFiniteNumber(
  obj: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  if (!obj) return undefined;
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Pull the current-prompt context window snapshot out of Claude Code's
 * `context_window` block. Returns `undefined` when the block is absent
 * so callers can branch on "Claude Code didn't tell us". Used tokens
 * sum the three current-usage components Claude Code reports:
 * `input_tokens` (uncached new input), `cache_read_input_tokens`
 * (cache hits this turn), and `cache_creation_input_tokens` (writes to
 * cache this turn) — together they're the actual number of input
 * tokens in the prompt the model just saw.
 */
function adaptContextWindow(value: unknown): StdinPayload["contextWindow"] | undefined {
  if (!isPlainObject(value)) return undefined;
  const currentUsage = isPlainObject(value["current_usage"]) ? value["current_usage"] : undefined;
  const usedInput = pickFiniteNumber(currentUsage, "input_tokens");
  const usedCacheRead = pickFiniteNumber(currentUsage, "cache_read_input_tokens");
  const usedCacheCreate = pickFiniteNumber(currentUsage, "cache_creation_input_tokens");
  const usedTokens =
    usedInput !== undefined || usedCacheRead !== undefined || usedCacheCreate !== undefined
      ? (usedInput ?? 0) + (usedCacheRead ?? 0) + (usedCacheCreate ?? 0)
      : undefined;
  const windowSize = pickFiniteNumber(value, "context_window_size");
  const usedPercentage = pickFiniteNumber(value, "used_percentage");
  if (usedTokens === undefined && windowSize === undefined && usedPercentage === undefined) {
    return undefined;
  }
  return {
    ...(usedTokens !== undefined ? { usedTokens } : {}),
    ...(windowSize !== undefined ? { windowSize } : {}),
    ...(usedPercentage !== undefined ? { usedPercentage } : {}),
  };
}

type RateLimitWindow = { readonly usedPercentage?: number; readonly resetsAt?: number };

function adaptRateLimitWindow(value: unknown): RateLimitWindow | undefined {
  if (!isPlainObject(value)) return undefined;
  const usedPercentage = pickFiniteNumber(value, "used_percentage");
  const resetsAt = pickFiniteNumber(value, "resets_at");
  if (usedPercentage === undefined && resetsAt === undefined) return undefined;
  return {
    ...(usedPercentage !== undefined ? { usedPercentage } : {}),
    ...(resetsAt !== undefined ? { resetsAt } : {}),
  };
}

/**
 * Pull the usage-limit snapshot out of Claude Code's `rate_limits` block
 * (`five_hour` / `seven_day`, each `{ used_percentage, resets_at }`).
 * Returns `undefined` when the block is absent so usage widgets can hide
 * rather than invent a number. Each window is adapted independently — a
 * payload that ships only one still surfaces it.
 */
function adaptRateLimits(value: unknown): StdinPayload["rateLimits"] | undefined {
  if (!isPlainObject(value)) return undefined;
  const fiveHour = adaptRateLimitWindow(value["five_hour"]);
  const sevenDay = adaptRateLimitWindow(value["seven_day"]);
  if (fiveHour === undefined && sevenDay === undefined) return undefined;
  return {
    ...(fiveHour ? { fiveHour } : {}),
    ...(sevenDay ? { sevenDay } : {}),
  };
}

export async function readStdinPayload(stream: NodeJS.ReadableStream): Promise<StdinPayload> {
  const buf = await readBounded(stream, MAX_PAYLOAD_BYTES);
  if (buf.byteLength === 0) {
    return { raw: {}, truncated: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(buf.toString("utf8"));
  } catch (err) {
    throw new StdinParseError("invalid stdin JSON", err);
  }
  if (!isPlainObject(parsed)) {
    throw new StdinParseError("stdin payload must be a JSON object");
  }
  return adaptStatuslinePayload(parsed, {
    truncated: buf.byteLength === MAX_PAYLOAD_BYTES,
  });
}

async function readBounded(stream: NodeJS.ReadableStream, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    const remaining = limit - total;
    if (buf.byteLength >= remaining) {
      chunks.push(buf.subarray(0, remaining));
      total = limit;
      break;
    }
    chunks.push(buf);
    total += buf.byteLength;
  }
  return Buffer.concat(chunks, total);
}
