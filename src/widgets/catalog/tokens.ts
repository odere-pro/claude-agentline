/**
 * Token counts + throughput — `tokens-total` / `-input` / `-output` /
 * `-cached`, plus `input-speed` / `output-speed` / `total-speed`.
 */

import { entry, type WidgetMeta } from "./types.js";

export const TOKENS_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  "tokens-total": entry(
    "Tokens (total)",
    "Running token total for the chosen reset axis",
    "tokens",
  ),
  "tokens-input": entry(
    "Tokens (input)",
    "Input-token subtotal for the chosen reset axis",
    "tokens",
  ),
  "tokens-output": entry(
    "Tokens (output)",
    "Output-token subtotal for the chosen reset axis",
    "tokens",
  ),
  "tokens-cached": entry("Tokens (cached)", "Cached-token subtotal (prompt-cache hits)", "tokens"),
  "input-speed": entry("Input speed", "Input tokens per second over the active window", "tokens"),
  "output-speed": entry(
    "Output speed",
    "Output tokens per second over the active window",
    "tokens",
  ),
  "total-speed": entry("Total speed", "Combined token throughput per second", "tokens"),
});
