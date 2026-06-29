/**
 * `model` widget (§7.2). Resolves a model id to a friendly display name;
 * falls back to the raw id (or hides when stdin omits `model`).
 *
 * This whole path is a last resort: the widget prefers the host's
 * `display_name` (see render below), which modern hosts always send.
 */

import { resolveRole } from "../../data/theme/index.js";
import type { Cell } from "../cell/cell.js";
import { defineWidget } from "../widget.js";

interface ModelOptions {
  readonly label?: string;
}

/*
 * Override table — escape hatch for any id the generic prettifier below
 * gets wrong. Every shipped model uses the modern
 * `claude-<name>-<major>[-<minor>]` shape, which the prettifier derives
 * correctly (e.g. `claude-opus-3` → "Opus 3"), so this is intentionally
 * empty: adding a new model needs no row here. Add an entry only for an
 * id the prettifier would render incorrectly.
 */
const MODEL_DISPLAY_NAMES: Readonly<Record<string, string>> = Object.freeze({});

/*
 * Derive "<Name> <major>.<minor>" from a `claude-<name>-<major>-<minor>`
 * id: drop the `claude-` prefix and any trailing 8-digit release date,
 * title-case the name, and join the numeric version parts with a dot.
 * Scoped to the `claude-` namespace — a non-`claude-` id (or one that
 * does not fit the shape) is returned verbatim, so the override table
 * or the raw id is shown rather than a mis-cased guess.
 */
function prettifyModelId(id: string): string {
  const base = id.split("[")[0]!; // drop a variant suffix like "[1m]"
  if (!base.startsWith("claude-")) return id;
  const stripped = base.slice("claude-".length);
  const segments = stripped.split("-").filter(Boolean);
  if (segments.length === 0) return id;

  const withoutDate =
    segments.length > 1 && /^\d{8}$/.test(segments[segments.length - 1]!)
      ? segments.slice(0, -1)
      : segments;

  const [name, ...rest] = withoutDate;
  if (!name) return id;
  const version = rest.filter((part) => /^\d+$/.test(part));
  // Any non-numeric segment means this isn't a <name>-<version> id.
  if (version.length !== rest.length) return id;

  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return version.length > 0 ? `${label} ${version.join(".")}` : label;
}

export function modelDisplayName(id: string): string {
  return MODEL_DISPLAY_NAMES[id] ?? prettifyModelId(id);
}

export const modelWidget = defineWidget<ModelOptions>("model", (ctx, settings): Cell => {
  const id = ctx.session?.model ?? ctx.stdin.model;
  if (!id && !ctx.stdin.modelDisplayName) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  const fg = resolveRole(ctx.theme, "accent");
  /*
   * Prefer Claude Code's `display_name` (e.g. "Opus 4.7 (1M context)")
   * over the local id→label fallback — Claude Code is authoritative for
   * variants like the 1M-context suffix (`claude-opus-4-7[1m]`), which
   * the local derivation cannot fully enumerate.
   */
  const display = ctx.stdin.modelDisplayName ?? (id ? modelDisplayName(id) : "");
  return { text: `${label}${display}`, fg };
});
