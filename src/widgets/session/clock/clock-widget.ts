/**
 * `clock` widget (session family).
 *
 * Renders the current time-of-day read through `ctx.clock.now()` — never
 * `Date.now()` — so golden tests stay byte-stable under a frozen clock
 * (the render-determinism contract, D-006). Time is formatted in UTC for
 * the same reason: a wall-clock-local render would differ across CI
 * runners and time zones.
 *
 * Options:
 *   - `format`  "24h" (default) → `HH:MM`; "12h" → `H:MMam`/`H:MMpm`.
 *   - `seconds` true → append `:SS`.
 *
 * Pure `(ctx, settings) → Cell`; never hidden (the clock always has a value).
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import type { WidgetContext } from "../../types.js";

interface ClockOptions {
  readonly label?: string;
  /** "24h" (default) or "12h". */
  readonly format?: "24h" | "12h";
  /** Append `:SS` when true. */
  readonly seconds?: boolean;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function format24(h: number, m: number, s: number, withSeconds: boolean): string {
  const base = `${pad2(h)}:${pad2(m)}`;
  return withSeconds ? `${base}:${pad2(s)}` : base;
}

function format12(h: number, m: number, s: number, withSeconds: boolean): string {
  const meridiem = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const base = `${hour12}:${pad2(m)}`;
  const withSecs = withSeconds ? `${base}:${pad2(s)}` : base;
  return `${withSecs}${meridiem}`;
}

export const clockWidget = defineWidget<ClockOptions>(
  "clock",
  (ctx: WidgetContext, settings): Cell => {
    const now = ctx.clock.now();
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    const s = now.getUTCSeconds();
    const withSeconds = settings.options.seconds === true;

    const time =
      settings.options.format === "12h"
        ? format12(h, m, s, withSeconds)
        : format24(h, m, s, withSeconds);

    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${time}` };
  },
);
