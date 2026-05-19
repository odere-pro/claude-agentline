/**
 * Aggregate transcript events along a reset axis (§7.3, §8.4).
 *
 * Each `tokens-*` widget declares its `reset` axis. The aggregator
 * filters events that fall inside the current window for that axis
 * and sums the four token totals. Mixed-axis aggregation is
 * forbidden — every widget queries its own axis explicitly.
 */

import type { TranscriptEvent } from "./transcript.js";

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

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
 * Each axis owns the predicate that decides whether a transcript
 * event belongs to the current window. Adding a new axis is a
 * single-entry change — extend `ResetAxis`, add the matching
 * filter here. `Record<ResetAxis, …>` keeps the table exhaustive
 * at compile time, replacing the old switch.
 */
type AxisFilter = (ev: TranscriptEvent, input: AggregateInput) => boolean;

const AXIS_FILTERS: Readonly<Record<ResetAxis, AxisFilter>> = Object.freeze({
  session: (ev, input) =>
    input.sessionStart === undefined ? true : ev.timestamp >= input.sessionStart,
  block: (ev, input) => {
    const anchor = resolveBlockAnchor(input);
    const offset = (input.now - anchor) % FIVE_HOURS_MS;
    return ev.timestamp >= input.now - offset;
  },
  day: (ev, input) => ev.timestamp >= startOfLocalDay(input.now),
  week: (ev, input) => ev.timestamp >= startOfLocalWeek(input.now, input.weekReset),
  model: (ev, input) => input.model !== undefined && ev.model === input.model,
  effort: (ev, input) => input.effort !== undefined && ev.effort === input.effort,
});

function withinWindow(ev: TranscriptEvent, input: AggregateInput): boolean {
  return AXIS_FILTERS[input.axis](ev, input);
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

export const DAY_MS = ONE_DAY_MS;
export const FIVE_HOURS = FIVE_HOURS_MS;
