/**
 * Merge-mode union used by both the widget render contract (`Cell.merged`)
 * and the config schema mirror (`WidgetConfig.merged`).
 *
 * Lives in `core/lib/` because both layers need it: `data/` imports it for
 * the typed config, `widgets/` imports it for the rendered cell. Putting
 * the literal union in one place stops the data layer's mirror from
 * silently lagging the widget contract when a fourth mode is added.
 *
 *   - "off"               — no merging; the host separator is rendered.
 *   - "merge"             — merge with the left neighbour, separator
 *                            replaced by widget padding.
 *   - "merge-no-padding"  — merge with the left neighbour, no padding
 *                            between the two cells (visually adjacent).
 */
export type MergeMode = "off" | "merge" | "merge-no-padding";
