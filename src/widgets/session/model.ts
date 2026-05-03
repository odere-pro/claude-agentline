/**
 * `model` widget (§7.2). Maps known model ids → display names; falls
 * back to the raw id (or hides when stdin omits `model`).
 */

import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";

interface ModelOptions {
  readonly label?: string;
}

const MODEL_DISPLAY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "claude-opus-4-7": "Opus 4.7",
  "claude-opus-4-5": "Opus 4.5",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-sonnet-4-5": "Sonnet 4.5",
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "claude-haiku-4-5": "Haiku 4.5",
});

export function modelDisplayName(id: string): string {
  return MODEL_DISPLAY_NAMES[id] ?? id;
}

export const modelWidget = defineWidget<ModelOptions>("model", (ctx, settings): Cell => {
  const id = ctx.session?.model ?? ctx.stdin.model;
  if (!id) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${modelDisplayName(id)}` };
});
