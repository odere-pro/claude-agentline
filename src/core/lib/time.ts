/**
 * Shared millisecond constants for window / TTL math across widgets and data.
 *
 * Pure constants, no imports. Lives in `core/lib/` so any layer can consume
 * them without crossing module boundaries.
 */

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const FIVE_HOURS_MS = 5 * HOUR_MS;
export const ONE_WEEK_MS = 7 * DAY_MS;
