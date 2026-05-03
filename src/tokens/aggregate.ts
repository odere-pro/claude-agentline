/**
 * Aggregate transcript events along a reset axis (§7.3, §8.4).
 *
 * Each `tokens-*` and `cost` widget declares its `reset` axis. The
 * aggregator filters events that fall inside the current window for
 * that axis and sums the four token totals. Mixed-axis aggregation
 * is forbidden — every widget queries its own axis explicitly.
 */

import { priceForModel } from "./pricing.js";
import type { TranscriptEvent } from "./transcript.js";

export type ResetAxis = "session" | "block" | "day" | "week" | "model" | "effort";

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

export function aggregateCost(input: AggregateInput): number {
  let cost = 0;
  const byModel = new Map<string, { input: number; output: number; cached: number }>();
  for (const ev of input.events) {
    if (!withinWindow(ev, input)) continue;
    const key = ev.model ?? input.model ?? "";
    const acc = byModel.get(key) ?? { input: 0, output: 0, cached: 0 };
    acc.input += ev.inputTokens;
    acc.output += ev.outputTokens;
    acc.cached += ev.cachedTokens;
    byModel.set(key, acc);
  }
  for (const [model, totals] of byModel) {
    const price = priceForModel(model);
    cost +=
      (totals.input * price.input +
        totals.output * price.output +
        totals.cached * price.cached) /
      1_000_000;
  }
  return cost;
}

function withinWindow(ev: TranscriptEvent, input: AggregateInput): boolean {
  switch (input.axis) {
    case "session":
      return input.sessionStart === undefined ? true : ev.timestamp >= input.sessionStart;
    case "block": {
      const anchor = resolveBlockAnchor(input);
      const offset = (input.now - anchor) % FIVE_HOURS_MS;
      const blockStart = input.now - offset;
      return ev.timestamp >= blockStart;
    }
    case "day": {
      const dayStart = startOfLocalDay(input.now);
      return ev.timestamp >= dayStart;
    }
    case "week": {
      const weekStart = startOfLocalWeek(input.now);
      return ev.timestamp >= weekStart;
    }
    case "model":
      return input.model !== undefined && ev.model === input.model;
    case "effort":
      return input.effort !== undefined && ev.effort === input.effort;
  }
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

function startOfLocalWeek(now: number): number {
  const d = new Date(now);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
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

export function weekStart(now: number): number {
  return startOfLocalWeek(now);
}

export const DAY_MS = ONE_DAY_MS;
export const FIVE_HOURS = FIVE_HOURS_MS;
