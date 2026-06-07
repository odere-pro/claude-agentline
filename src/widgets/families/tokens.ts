/**
 * Token counts + throughput, plus the host-reported cost scalars —
 * `tokens` / `tokens-cached` / `token-speed`, and the cost-block widgets
 * `cost-usd` / `cost-burn-rate` / `api-duration` / `cost-efficiency` /
 * `cost-vs-limit`. The cost widgets read host pre-computed scalars, so
 * they carry no reset axis (only the token accumulators declare one).
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
  "cost-usd": entry(
    "Cost (USD)",
    "Host-reported session cost in USD (e.g. $1.23)",
    "tokens",
  ),
  "cost-burn-rate": entry(
    "Cost burn rate",
    "Session spend rate in USD per hour (e.g. $1.20/hr)",
    "tokens",
  ),
  "api-duration": entry(
    "API duration",
    "Time spent waiting on the API (absolute, or percent of wall)",
    "tokens",
  ),
  "cost-efficiency": entry(
    "Cost efficiency",
    "Share of wall-clock spent in API calls, as a percent",
    "tokens",
  ),
  "cost-vs-limit": entry(
    "Cost vs limit",
    "Session spend against a configured budget (e.g. $1.20/$5)",
    "tokens",
  ),
});
