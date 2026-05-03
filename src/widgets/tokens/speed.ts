/**
 * `input-speed`, `output-speed`, `total-speed` widgets (§7.3).
 * Rolling-window rate (default 60 s) configured via
 * `options.windowSec`. Hides when the snapshot is unavailable.
 */

import { rollingSpeed } from "../../tokens/index.js";
import { defineWidget } from "../widget.js";
import { formatSpeed } from "./format.js";

interface Options {
  readonly label?: string;
  readonly windowSec?: number;
}

const DEFAULT_WINDOW_SEC = 60;

function windowMs(opt: number | undefined): number {
  if (typeof opt !== "number" || !Number.isFinite(opt) || opt <= 0) {
    return DEFAULT_WINDOW_SEC * 1000;
  }
  return Math.min(Math.max(opt, 1), 3600) * 1000;
}

export const inputSpeedWidget = defineWidget<Options>("input-speed", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const speed = rollingSpeed({
    events: snapshot.events,
    now: snapshot.now,
    windowMs: windowMs(settings.options.windowSec),
  });
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${formatSpeed(speed.inputPerSec)}` };
});

export const outputSpeedWidget = defineWidget<Options>("output-speed", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const speed = rollingSpeed({
    events: snapshot.events,
    now: snapshot.now,
    windowMs: windowMs(settings.options.windowSec),
  });
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${formatSpeed(speed.outputPerSec)}` };
});

export const totalSpeedWidget = defineWidget<Options>("total-speed", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const speed = rollingSpeed({
    events: snapshot.events,
    now: snapshot.now,
    windowMs: windowMs(settings.options.windowSec),
  });
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${formatSpeed(speed.totalPerSec)}` };
});
