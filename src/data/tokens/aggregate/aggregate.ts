/**
 * Aggregate transcript events along a reset axis (§7.3, §8.4).
 *
 * Each `tokens-*` widget declares its `reset` axis. The aggregator
 * filters events that fall inside the current window for that axis
 * and sums the four token totals. Mixed-axis aggregation is
 * forbidden — every widget queries its own axis explicitly.
 */

import { DAY_MS, FIVE_HOURS_MS } from "../../../core/lib/time.js";

import type { TranscriptEvent } from "../transcript/transcript.js";

export type ResetAxis = "session" | "block" | "day" | "week" | "model" | "effort";

/**
 * Anchor for the weekly window. The host's real weekly reset is
 * account-specific (e.g. a Thursday-noon reset) and is *not* present in
 * the Claude Code stdin payload, so the user pins it explicitly. Unset
 * fields fall back to local Monday 00:00 — the historical default.
 */
export interface WeekResetOpts {
  /** 0 = Sunday … 6 = Saturday (matches `Date.getDay()`). Default 1 (Monday). */
  readonly weekday?: number;
  /** Hour of day 0–23; minutes are pinned to 0. Default 0. */
  readonly hour?: number;
}

export interface AggregateInput {
  readonly events: readonly TranscriptEvent[];
  readonly axis: ResetAxis;
  readonly now: number;
  /** Session start (ms epoch). Used by `session` axis. */
  readonly sessionStart?: number;
  /** Anchor for the 5-h block (ms epoch). When omitted, derived from
   *  the first event timestamp; falls back to `now` for empty inputs. */
  readonly blockAnchor?: number;
  /** Current model id; used by axis === `model`. */
  readonly model?: string;
  /** Current effort tier; used by axis === `effort`. */
  readonly effort?: string;
  /** Weekly window anchor; used by axis === `week`. Unset → Monday 00:00. */
  readonly weekReset?: WeekResetOpts;
}

export interface TokenTotals {
  readonly input: number;
  readonly output: number;
  readonly cached: number;
  readonly total: number;
}

export function aggregate(input: AggregateInput): TokenTotals {
  const filtered = input.events.filter((ev) => withinWindow(ev, input));
  let inTok = 0;
  let outTok = 0;
  let cached = 0;
  for (const ev of filtered) {
    inTok += ev.inputTokens;
    outTok += ev.outputTokens;
    cached += ev.cachedTokens;
  }
  return { input: inTok, output: outTok, cached, total: inTok + outTok + cached };
}

/**
 * Reset-axis windowing strategy table (§7.3, §8.4).
 *
 * Each axis owns a `Strategy` record bundling the predicate that
 * decides whether a transcript event belongs to the current window
 * with the timestamp (if any) at which that window ends. Adding a new
 * axis is a single-entry change — extend `ResetAxis`, add the matching
 * strategy here. `Record<ResetAxis, …>` keeps the table exhaustive at
 * compile time; the schema validator and `resolveResetAxis` both
 * derive their accepted-axis set from `RESET_AXES` below, so the
 * vocabulary stays consistent end to end.
 */
export type AxisFilter = (ev: TranscriptEvent, input: AggregateInput) => boolean;

export interface AxisStrategy {
  /** Predicate: does this event belong to the current window for the axis? */
  readonly filter: AxisFilter;
  /**
   * Timestamp at which the current window ends, or `null` for axes
   * that scope by identity (model, effort) or by open-ended session
   * boundary. Used by rate-limit / reset-at widgets to render the
   * next-reset countdown.
   */
  readonly windowEnd: (input: AggregateInput) => number | null;
}

const STRATEGIES: Record<ResetAxis, AxisStrategy> = {
  session: {
    filter: (ev: TranscriptEvent, input: AggregateInput): boolean =>
      input.sessionStart === undefined ? true : ev.timestamp >= input.sessionStart,
    windowEnd: (): number | null => null,
  },
  block: {
    filter: (ev: TranscriptEvent, input: AggregateInput): boolean => {
      const anchor = resolveBlockAnchor(input);
      const offset = (input.now - anchor) % FIVE_HOURS_MS;
      return ev.timestamp >= input.now - offset;
    },
    windowEnd: (input: AggregateInput): number =>
      blockEnd({ now: input.now, blockAnchor: input.blockAnchor }),
  },
  day: {
    filter: (ev: TranscriptEvent, input: AggregateInput): boolean =>
      ev.timestamp >= startOfLocalDay(input.now),
    windowEnd: (input: AggregateInput): number => startOfLocalDay(input.now) + DAY_MS,
  },
  week: {
    filter: (ev: TranscriptEvent, input: AggregateInput): boolean =>
      ev.timestamp >= startOfLocalWeek(input.now, input.weekReset),
    windowEnd: (input: AggregateInput): number =>
      startOfLocalWeek(input.now, input.weekReset) + 7 * DAY_MS,
  },
  model: {
    filter: (ev: TranscriptEvent, input: AggregateInput): boolean =>
      input.model !== undefined && ev.model === input.model,
    windowEnd: (): number | null => null,
  },
  effort: {
    filter: (ev: TranscriptEvent, input: AggregateInput): boolean =>
      input.effort !== undefined && ev.effort === input.effort,
    windowEnd: (): number | null => null,
  },
};

export const AXIS_STRATEGIES: Readonly<Record<ResetAxis, AxisStrategy>> = Object.freeze(STRATEGIES);

/** Canonical, ordered list of accepted reset axes. */
export const RESET_AXES: readonly ResetAxis[] = Object.freeze(
  Object.keys(AXIS_STRATEGIES) as ResetAxis[],
);

function withinWindow(ev: TranscriptEvent, input: AggregateInput): boolean {
  return AXIS_STRATEGIES[input.axis].filter(ev, input);
}

function resolveBlockAnchor(input: AggregateInput): number {
  if (input.blockAnchor !== undefined) return input.blockAnchor;
  const first = input.events[0];
  if (first) return first.timestamp;
  return input.now;
}

function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfLocalWeek(now: number, opts?: WeekResetOpts): number {
  const weekday = opts?.weekday ?? 1;
  const hour = opts?.hour ?? 0;
  const d = new Date(now);
  const diff = (d.getDay() - weekday + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(hour, 0, 0, 0);
  // If the computed anchor lands in the future (target weekday is today
  // but the reset hour has not arrived yet), step back a full week to the
  // most recent reset that has actually passed.
  if (d.getTime() > now) d.setDate(d.getDate() - 7);
  return d.getTime();
}

export function blockStart(input: { now: number; blockAnchor?: number }): number {
  const anchor = input.blockAnchor ?? input.now;
  const offset = (input.now - anchor) % FIVE_HOURS_MS;
  return input.now - offset;
}

export function blockEnd(input: { now: number; blockAnchor?: number }): number {
  return blockStart(input) + FIVE_HOURS_MS;
}

export function dayStart(now: number): number {
  return startOfLocalDay(now);
}

export function weekStart(now: number, opts?: WeekResetOpts): number {
  return startOfLocalWeek(now, opts);
}
