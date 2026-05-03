/**
 * `model-usage`, `effort-usage`, and `compaction-counter` widgets
 * (§7.5). These all read the transcript snapshot and aggregate along
 * a single dimension that is not user-configurable:
 *
 *   - `model-usage`        axis fixed to `model`; aggregates tokens
 *                          where `event.model === stdin.model`.
 *   - `effort-usage`       axis fixed to `effort`; aggregates tokens
 *                          where `event.effort === stdin.thinkingEffort`.
 *   - `compaction-counter` count of `compaction === true` events in
 *                          the JSONL transcript.
 *
 * §8.4 forbids mixed-axis sums; these widgets pick one axis and stick
 * to it, so the contract is honoured by construction.
 */

import { aggregate } from "../../tokens/index.js";
import { defineWidget } from "../widget.js";
import { formatCount } from "../tokens/format.js";

interface UsageOptions {
  readonly label?: string;
}

interface CompactionOptions {
  readonly label?: string;
  readonly hideZero?: boolean;
}

export const modelUsageWidget = defineWidget<UsageOptions>("model-usage", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const model = ctx.stdin.model;
  if (!model) return { text: "", hidden: true };
  const totals = aggregate({
    events: snapshot.events,
    axis: "model",
    now: snapshot.now,
    sessionStart: snapshot.sessionStart,
    blockAnchor: snapshot.blockAnchor,
    model,
  });
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${formatCount(totals.total)}` };
});

export const effortUsageWidget = defineWidget<UsageOptions>("effort-usage", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const effort = ctx.stdin.thinkingEffort;
  if (!effort) return { text: "", hidden: true };
  const totals = aggregate({
    events: snapshot.events,
    axis: "effort",
    now: snapshot.now,
    sessionStart: snapshot.sessionStart,
    blockAnchor: snapshot.blockAnchor,
    effort,
  });
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${formatCount(totals.total)}` };
});

export const compactionCounterWidget = defineWidget<CompactionOptions>(
  "compaction-counter",
  (ctx, settings) => {
    const snapshot = ctx.tokens;
    if (!snapshot) return { text: "", hidden: true };
    let count = 0;
    for (const ev of snapshot.events) {
      if (ev.compaction) count += 1;
    }
    const hideZero = settings.options.hideZero !== false;
    if (count === 0 && hideZero) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${count}` };
  },
);
