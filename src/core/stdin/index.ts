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

import { isPlainObject, pickBoolean, pickString, pickStringArray } from "../lib/object/object.js";

const MAX_PAYLOAD_BYTES = 256 * 1024;

/**
 * Anti-corruption-layer version tag. The translator stamps every
 * adapted `StdinPayload` with this number; bumping it signals that
 * `adaptStatuslinePayload` learned a new Claude Code statusline shape.
 * Downstream consumers (cached replay, future contract-drift shims)
 * inspect the stamp to know which translator dialect wrote the payload.
 *
 * Bump rules: increment when adding a new field, renaming, or changing
 * the meaning of an existing field. Pure additions to `raw` passthrough
 * do not require a bump.
 */
export const STATUSLINE_TRANSLATOR_VERSION = 4;

export interface StdinPayload {
  /** Original parsed JSON, fields untouched. */
  raw: Record<string, unknown>;
  /** True when the payload was clipped at MAX_PAYLOAD_BYTES. */
  truncated: boolean;
  /**
   * The `STATUSLINE_TRANSLATOR_VERSION` value the adapter stamped on
   * this payload. Present on every payload produced by
   * `adaptStatuslinePayload` / `readStdinPayload`. Optional on the
   * type so test fixtures and direct producers can omit it; readers
   * branching on dialect should compare against the constant.
   */
  translatorVersion?: number;
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
   * Active editor vim mode, lower-cased. Known values: `"normal"`,
   * `"insert"`, `"visual"`, `"visual line"`. Same forward-compat reasoning
   * as `thinkingEffort` — an unknown future mode passes through untouched.
   *
   * The host reports this nested and uppercase — `vim: { mode: "NORMAL" }`
   * (Claude Code version 2.1.193+). The adapter also dual-reads the older flat
   * `vim_mode` key for back-compat; the nested block wins when both exist.
   */
  vimMode?: string;
  transcriptPath?: string;
  /**
   * Current-prompt context window snapshot Claude Code reports. The
   * `context-percentage` widget reads this directly so the value reflects
   * the CURRENT turn's window usage (what the user sees in Claude Code)
   * instead of a cumulative session sum, which can exceed the model's
   * window many times over.
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
  /**
   * Session-cost snapshot Claude Code reports in its `cost` block.
   * The host pre-computes these scalars; widgets read them directly
   * (no transcript aggregation, no reset axis).
   *
   *   - `totalUsd`        ← `total_cost_usd`
   *   - `totalDurationMs` ← `total_duration_ms`
   *   - `apiDurationMs`   ← `total_api_duration_ms`
   *   - `linesAdded`      ← `total_lines_added`
   *   - `linesRemoved`    ← `total_lines_removed`
   *
   * Each field is independently optional — a partial block still surfaces
   * what it can. The block is absent on older Claude Code versions.
   */
  cost?: {
    readonly totalUsd?: number;
    readonly totalDurationMs?: number;
    readonly apiDurationMs?: number;
    readonly linesAdded?: number;
    readonly linesRemoved?: number;
  };
  /**
   * Subagent persona name Claude Code reports in its `agent` block
   * (`agent.name`). Present while a named subagent is driving the
   * session; absent on the main agent. The `agent-name` widget reads it
   * directly and hides when absent.
   */
  agentName?: string;
  /**
   * The directory the host was launched in, from
   * `workspace.project_dir`. Distinct from `cwd`
   * (`workspace.current_dir`): the user may have `cd`'d into a
   * subdirectory after launch, or the launch dir may not be a git repo.
   * The `project-dir` widget renders its basename.
   */
  projectDir?: string;
  /**
   * Extra workspace roots added via `/add-dir`, from
   * `workspace.added_dirs`. The array is kept (not pre-counted) so a
   * widget can show either a count or the list; `added-dirs` renders the
   * count. Omitted when the field is absent, not an array, or empty.
   */
  addedDirs?: readonly string[];
  /**
   * Host-reported flag (`exceeds_200k_tokens`) that the current prompt
   * exceeds the 200k-token threshold — the point at which long-context
   * pricing/behaviour kicks in. The `context-200k-flag` widget shows a
   * badge when true and hides otherwise. Only set when the host sent a
   * real boolean.
   */
  exceeds200kTokens?: boolean;
  /**
   * Whether extended thinking is on, from the host's `thinking.enabled`
   * block. Complements `thinkingEffort` (which level): this is the
   * on/off switch. The `thinking-enabled` widget reads it; only set when
   * the host sent a real boolean.
   */
  thinkingEnabled?: boolean;
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
 *   - `vim`           → `{ mode }` (UPPERCASE)  → lower-cased `vimMode`,
 *                                                 flat `vim_mode` fallback
 *
 * The adapter normalises both shapes (and accepts a flat-string `model`
 * for back-compat with the older docs, and the flat `vim_mode` key older
 * hosts sent), so widgets read a single camelCase, flat-string surface.
 */
export function adaptStatuslinePayload(
  raw: Record<string, unknown>,
  opts: { truncated?: boolean } = {},
): StdinPayload {
  const modelBlock = isPlainObject(raw["model"]) ? raw["model"] : undefined;
  const outputStyleBlock = isPlainObject(raw["output_style"]) ? raw["output_style"] : undefined;
  const effortBlock = isPlainObject(raw["effort"]) ? raw["effort"] : undefined;
  const workspaceBlock = isPlainObject(raw["workspace"]) ? raw["workspace"] : undefined;
  const agentBlock = isPlainObject(raw["agent"]) ? raw["agent"] : undefined;
  const thinkingBlock = isPlainObject(raw["thinking"]) ? raw["thinking"] : undefined;
  const vimBlock = isPlainObject(raw["vim"]) ? raw["vim"] : undefined;
  const contextWindow = adaptContextWindow(raw["context_window"]);
  const rateLimits = adaptRateLimits(raw["rate_limits"]);
  const cost = adaptCost(raw["cost"]);
  const agentName = pickString(agentBlock, "name");
  const projectDir = pickString(workspaceBlock, "project_dir");
  const addedDirs = pickStringArray(workspaceBlock, "added_dirs");
  const exceeds200kTokens = pickBoolean(raw, "exceeds_200k_tokens");
  const thinkingEnabled = pickBoolean(thinkingBlock, "enabled");
  return {
    raw,
    truncated: opts.truncated ?? false,
    translatorVersion: STATUSLINE_TRANSLATOR_VERSION,
    model: pickString(modelBlock, "id") ?? pickString(raw, "model"),
    modelDisplayName: pickString(modelBlock, "display_name"),
    version: pickString(raw, "version"),
    outputStyle: pickString(outputStyleBlock, "name") ?? pickString(raw, "output_style"),
    sessionId: pickString(raw, "session_id"),
    sessionName: pickString(raw, "session_name"),
    cwd: pickString(raw, "cwd") ?? pickString(workspaceBlock, "current_dir"),
    thinkingEffort: pickString(effortBlock, "level"),
    vimMode: pickString(vimBlock, "mode")?.toLowerCase() ?? pickString(raw, "vim_mode"),
    transcriptPath: pickString(raw, "transcript_path"),
    ...(agentName !== undefined ? { agentName } : {}),
    ...(projectDir !== undefined ? { projectDir } : {}),
    ...(addedDirs !== undefined ? { addedDirs } : {}),
    ...(exceeds200kTokens !== undefined ? { exceeds200kTokens } : {}),
    ...(thinkingEnabled !== undefined ? { thinkingEnabled } : {}),
    ...(contextWindow ? { contextWindow } : {}),
    ...(rateLimits ? { rateLimits } : {}),
    ...(cost ? { cost } : {}),
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
 * Pull the session-cost snapshot out of Claude Code's `cost` block.
 * Returns `undefined` when the block is absent so cost widgets can hide
 * rather than invent a number. Each field is adapted independently — a
 * partial block still surfaces what it can.
 */
function adaptCost(value: unknown): StdinPayload["cost"] | undefined {
  if (!isPlainObject(value)) return undefined;
  const totalUsd = pickFiniteNumber(value, "total_cost_usd");
  const totalDurationMs = pickFiniteNumber(value, "total_duration_ms");
  const apiDurationMs = pickFiniteNumber(value, "total_api_duration_ms");
  const linesAdded = pickFiniteNumber(value, "total_lines_added");
  const linesRemoved = pickFiniteNumber(value, "total_lines_removed");
  if (
    totalUsd === undefined &&
    totalDurationMs === undefined &&
    apiDurationMs === undefined &&
    linesAdded === undefined &&
    linesRemoved === undefined
  ) {
    return undefined;
  }
  return {
    ...(totalUsd !== undefined ? { totalUsd } : {}),
    ...(totalDurationMs !== undefined ? { totalDurationMs } : {}),
    ...(apiDurationMs !== undefined ? { apiDurationMs } : {}),
    ...(linesAdded !== undefined ? { linesAdded } : {}),
    ...(linesRemoved !== undefined ? { linesRemoved } : {}),
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
    return { raw: {}, truncated: false, translatorVersion: STATUSLINE_TRANSLATOR_VERSION };
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
