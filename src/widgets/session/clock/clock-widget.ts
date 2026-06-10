/**
 * `clock` widget (session family).
 *
 * Renders the current time-of-day read through `ctx.clock.now()` — never
 * `Date.now()` — so golden tests stay byte-stable under a frozen clock
 * (the render-determinism contract, D-006). Time is rendered in the system's
 * local timezone by default; pass `timezone` (IANA string) to override.
 * Unit tests pin `timezone: "UTC"` to satisfy D-006 across CI runners.
 *
 * Options:
 *   - `format`   "24h" (default) → `HH:MM`; "12h" → `H:MMam`/`H:MMpm`.
 *   - `seconds`  true → append `:SS`.
 *   - `timezone` IANA timezone string (e.g. "Europe/Stockholm"). Omit for
 *                the system's local timezone.
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
  /** IANA timezone string (e.g. "Europe/Stockholm"). Defaults to system local. */
  readonly timezone?: string;
}

function extractTimeParts(
  date: Date,
  tz: string | undefined,
): { h: number; m: number; s: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(tz !== undefined ? { timeZone: tz } : {}),
  });
  const map = new Map<string, string>();
  for (const part of fmt.formatToParts(date)) map.set(part.type, part.value);
  return {
    h: (Number.parseInt(map.get("hour") ?? "0", 10) || 0) % 24,
    m: Number.parseInt(map.get("minute") ?? "0", 10) || 0,
    s: Number.parseInt(map.get("second") ?? "0", 10) || 0,
  };
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
    const { h, m, s } = extractTimeParts(now, settings.options.timezone);
    const withSeconds = settings.options.seconds === true;

    const time =
      settings.options.format === "12h"
        ? format12(h, m, s, withSeconds)
        : format24(h, m, s, withSeconds);

    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${time}` };
  },
);
