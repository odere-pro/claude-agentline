/**
 * Other family — miscellaneous host/editor signals that don't belong to a
 * data-domain family: `clock`, `added-dirs`, `output-style`, `vim-mode`.
 *
 * These were originally catalogued under `session` (and their render-fn
 * folders still live under `src/widgets/session/`); only the catalogue
 * `family` field moved here. The registry dispatches by `type`, not by
 * folder, so the move is metadata-only — no render code relocated.
 */

import { entry, v, type WidgetMeta } from "./catalog-types.js";

export const OTHER_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  clock: entry(
    "Clock",
    "Local time of day (24h or 12h); set the timezone option for an IANA override",
    "other",
    [
      v("24h", "24-hour (HH:MM)", { format: "24h" }),
      v("12h", "12-hour (H:MMam/pm)", { format: "12h" }),
    ],
  ),
  "added-dirs": entry(
    "Added dirs",
    "Count of extra workspace roots added via /add-dir (e.g. +2 dirs)",
    "other",
  ),
  "output-style": entry(
    "Output style",
    "Active output style (e.g. explanatory, learning)",
    "other",
  ),
  "vim-mode": entry("Vim mode", "Active vim mode (NORMAL, INSERT, …)", "other"),
});
