/**
 * Update-check module — npm registry probe + cache refresh helpers.
 *
 * **Render-path guarantee**: this module is never imported from any
 * file the render path transitively depends on. Gate 14
 * (`no-network-render`) is the trip-wire if that invariant slips. See
 * `src/update-check/fetch.ts` for the lone outbound HTTP call site.
 */

export { maybeRefresh } from "./refresh.js";
