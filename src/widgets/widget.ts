/**
 * Backwards-compatible re-export of Widget contract types and constructor.
 * Types are consolidated in `./types.ts` (§7.1).
 */

export type { WidgetSettings, WidgetRender, WidgetDef } from "./types.js";
export { defineWidget, eraseWidget } from "./types.js";
