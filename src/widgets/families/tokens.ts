/**
 * Token counts + throughput, plus the host-reported cost scalars —
 * `tokens` / `tokens-cached` / `token-speed`, and the cost-block widgets
 * `cost-usd` / `api-duration` / `cost-vs-limit`. The cost widgets read host
 * pre-computed scalars, so they carry no reset axis (only the token
 * accumulators declare one).
 *
 * `cost-burn-rate` and `cost-efficiency` were retired in issue #305: both
 * divided by `cost.total_duration_ms`, which is idle-inclusive lifetime
 * wall-clock, so neither number meant what its name implied. The honest
 * half of `cost-efficiency` survives as `api-duration` with
 * `options.percent`, which names the quantity it actually reports.
 */

import { entry, type WidgetMeta } from "./catalog-types.js";

export const TOKENS_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  tokens: entry("Tokens", "Input + output token subtotals for the chosen reset axis", "tokens"),
  "tokens-cached": entry(
    "Tokens (cached)",
    "Cached portion of the current context window",
    "tokens",
  ),
  "token-speed": entry(
    "Token speed",
    "Input + output tokens per second over the active window",
    "tokens",
  ),
  "cost-usd": entry("Cost (USD)", "Host-reported session cost in USD (e.g. $1.23)", "tokens"),
  "api-duration": entry(
    "API duration",
    "Time spent waiting on the API (absolute, or percent of wall)",
    "tokens",
  ),
  "cost-vs-limit": entry(
    "Cost vs limit",
    "Session spend against a configured budget (e.g. $1.20/$5)",
    "tokens",
  ),
});
