/**
 * `osc-link` widget — OSC 8 clickable hyperlink.
 *
 * Renders `options.label` (or `options.url` when no label given) as a
 * visible cell whose text is wrapped in the OSC 8 hyperlink escape by
 * the ANSI encoder. The encoder owns the actual escape emission so
 * width math sees only the visible label.
 *
 * Missing or empty `url` returns a hidden cell — there is no useful
 * fallback for a link without a target.
 */

import type { Cell } from "../cell.js";
import { HIDDEN_CELL } from "../cell.js";
import { defineWidget } from "../widget.js";

interface OscLinkOptions {
  readonly url?: string;
  readonly label?: string;
}

function trimToString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export const oscLinkWidget = defineWidget<OscLinkOptions>("osc-link", (_ctx, settings): Cell => {
  const url = trimToString(settings.options.url);
  if (url.length === 0) return HIDDEN_CELL;
  const labelRaw = trimToString(settings.options.label);
  const label = labelRaw.length > 0 ? labelRaw : url;
  return { text: label, href: url };
});
