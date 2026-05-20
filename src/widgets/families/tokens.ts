/**
 * Token counts + throughput — the merged `tokens` (input + output)
 * widget, the `tokens-cached` subtotal, and the merged `token-speed`
 * (input + output rate) widget.
 */

import { entry, type WidgetMeta } from "./catalog-types.js";

export const TOKENS_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  tokens: entry("Tokens", "Input + output token subtotals for the chosen reset axis", "tokens"),
  "tokens-cached": entry("Tokens (cached)", "Cached-token subtotal (prompt-cache hits)", "tokens"),
  "token-speed": entry(
    "Token speed",
    "Input + output tokens per second over the active window",
    "tokens",
  ),
});
