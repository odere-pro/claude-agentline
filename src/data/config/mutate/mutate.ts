/**
 * Programmatic config mutation (editor-redesign plan, step 3).
 *
 * Pure, immutable operations over `AgentlineConfig` — every function returns
 * a new config and never touches its input. Thin disk wrappers compose
 * `loadConfig` → mutate → validate → atomic write so the `agentline config
 * widget …` CLI (next PR) and the TUI editor share one code path.
 *
 * Bounds, enforced with `ConfigMutationError` (stable messages, no stack
 * surprises for callers that print `.message`):
 *   - at most `MAX_LINES` lines (indices 0..MAX_LINES-1); referencing a
 *     higher line pads the gap with empty lines on insert, and is rejected
 *     for remove/replace/move-source;
 *   - widget indices must point at an existing slot, except inserts, where
 *     the append position (`widgets.length`) is also valid;
 *   - a widget's `type` must be a built-in (looked up in `WIDGET_CATALOG`).
 *
 * Empty lines are kept, not trimmed — the renderer treats them as nothing
 * and the TUI shows a fixed set of rows.
 */

import { loadConfig } from "../load/load.js";
import { resolveConfigPaths } from "../paths/paths.js";
import type { AgentlineConfig, LineConfig, WidgetConfig } from "../types.js";
import { validateConfig } from "../validate/validate.js";
import { writeJsonIdempotent } from "../../../core/lib/atomic-write/atomic-write.js";
import { resolveEnv } from "../../../core/lib/env/env.js";
import { withFileLock } from "../../../core/lib/file-lock/file-lock.js";
import { WIDGET_CATALOG } from "../../../widgets/families/catalog.js";

import {
  ConfigMutationError,
  MAX_LINES,
  type AddWidgetSpec,
  type MoveWidgetSpec,
  type RemoveWidgetSpec,
  type ReplaceWidgetSpec,
  type SaveOptions,
  type SetWidgetOptionSpec,
} from "./mutate-types.js";

// The consumer-visible type surface (specs, error, hard caps) lives in
// `mutate-types.ts`; re-export here so existing
// `import { … } from "./mutate.js"` call sites stay valid.
export {
  ConfigMutationError,
  MAX_LINES,
  type AddWidgetSpec,
  type MoveWidgetSpec,
  type RemoveWidgetSpec,
  type ReplaceWidgetSpec,
  type SaveOptions,
  type SetWidgetOptionSpec,
  type WidgetCoord,
} from "./mutate-types.js";

function assertValidLineIndex(index: number | undefined): void {
  if (index === undefined) return;
  if (!Number.isInteger(index) || index < 0 || index >= MAX_LINES) {
    throw new RangeError(`line index out of bounds: ${index} (max: ${MAX_LINES - 1})`);
  }
}

// ─── pure operations ────────────────────────────────────────────────────────

/** Insert `widget` into `lines[line]` at `at` (or the end). */
export function addWidget(cfg: AgentlineConfig, spec: AddWidgetSpec): AgentlineConfig {
  assertWidgetType(spec.widget.type);
  assertLineWithinCap(spec.line, "add");
  const lines = cloneLines(cfg.lines, spec.line);
  const target = requireLine(lines, spec.line, "add");
  const at = spec.at ?? target.widgets.length;
  assertInsertIndex(at, target.widgets.length, spec.line);
  target.widgets.splice(at, 0, cloneWidget(spec.widget));
  return { ...cfg, lines };
}

/** Drop the widget at `lines[line][at]`. */
export function removeWidget(cfg: AgentlineConfig, spec: RemoveWidgetSpec): AgentlineConfig {
  const lines = cloneLines(cfg.lines);
  const target = requireLine(lines, spec.line, "remove");
  requireWidgetIndex(target.widgets.length, spec.at, spec.line);
  target.widgets.splice(spec.at, 1);
  return { ...cfg, lines };
}

/** Replace the widget at `lines[line][at]` with `widget`. */
export function replaceWidget(cfg: AgentlineConfig, spec: ReplaceWidgetSpec): AgentlineConfig {
  assertWidgetType(spec.widget.type);
  const lines = cloneLines(cfg.lines);
  const target = requireLine(lines, spec.line, "replace");
  requireWidgetIndex(target.widgets.length, spec.at, spec.line);
  target.widgets.splice(spec.at, 1, cloneWidget(spec.widget));
  return { ...cfg, lines };
}

/** Move a widget from one position to another (possibly across lines). */
export function moveWidget(cfg: AgentlineConfig, spec: MoveWidgetSpec): AgentlineConfig {
  assertLineWithinCap(spec.toLine, "move");
  const lines = cloneLines(cfg.lines, spec.toLine);
  const source = requireLine(lines, spec.fromLine, "move");
  requireWidgetIndex(source.widgets.length, spec.fromAt, spec.fromLine);
  const moved = source.widgets.splice(spec.fromAt, 1)[0];
  if (!moved)
    throw new ConfigMutationError(`move: no widget at line ${spec.fromLine} index ${spec.fromAt}`);
  const dest = requireLine(lines, spec.toLine, "move");
  const toAt = spec.toAt ?? dest.widgets.length;
  assertInsertIndex(toAt, dest.widgets.length, spec.toLine);
  dest.widgets.splice(toAt, 0, moved);
  return { ...cfg, lines };
}

/** Set `options[key] = value` on the widget at `lines[line][at]`. */
export function setWidgetOption(cfg: AgentlineConfig, spec: SetWidgetOptionSpec): AgentlineConfig {
  if (typeof spec.key !== "string" || spec.key.trim() === "") {
    throw new ConfigMutationError("widget option key must be a non-empty string");
  }
  if (spec.key === "__proto__" || spec.key === "constructor" || spec.key === "prototype") {
    throw new ConfigMutationError(`widget option key '${spec.key}' is not allowed`);
  }
  const lines = cloneLines(cfg.lines);
  const target = requireLine(lines, spec.line, "set-option");
  const widget = requireWidget(target, spec.at, spec.line);
  const options = { ...(widget.options ?? {}), [spec.key]: spec.value };
  target.widgets[spec.at] = { ...widget, options };
  return { ...cfg, lines };
}

/** Set the active theme id (or `null` to leave it unconfigured). */
export function setTheme(cfg: AgentlineConfig, themeId: string | null): AgentlineConfig {
  if (themeId !== null && (typeof themeId !== "string" || themeId.trim() === "")) {
    throw new ConfigMutationError("theme id must be a non-empty string or null");
  }
  return { ...cfg, theme: themeId };
}

/**
 * Set the statusline re-render cadence in seconds. `0` disables the
 * wall-clock timer (Claude Code reverts to event-driven updates);
 * `1`+ is the cadence. Mirrors the schema bound (`integer`, `minimum
 * 0`); `syncRefreshInterval` propagates the value into Claude Code's
 * `settings.json`.
 */
export function setRefreshInterval(cfg: AgentlineConfig, seconds: number): AgentlineConfig {
  if (!Number.isInteger(seconds) || seconds < 0) {
    throw new ConfigMutationError(
      `refresh interval must be a non-negative integer (got ${seconds})`,
    );
  }
  return { ...cfg, refreshInterval: seconds };
}

// ─── disk wrappers ──────────────────────────────────────────────────────────

export function saveAddWidget(spec: AddWidgetSpec, opts?: SaveOptions): Promise<AgentlineConfig> {
  return persist((cfg) => addWidget(cfg, spec), opts);
}

export function saveRemoveWidget(
  spec: RemoveWidgetSpec,
  opts?: SaveOptions,
): Promise<AgentlineConfig> {
  return persist((cfg) => removeWidget(cfg, spec), opts);
}

export function saveReplaceWidget(
  spec: ReplaceWidgetSpec,
  opts?: SaveOptions,
): Promise<AgentlineConfig> {
  return persist((cfg) => replaceWidget(cfg, spec), opts);
}

export function saveMoveWidget(spec: MoveWidgetSpec, opts?: SaveOptions): Promise<AgentlineConfig> {
  return persist((cfg) => moveWidget(cfg, spec), opts);
}

export function saveSetWidgetOption(
  spec: SetWidgetOptionSpec,
  opts?: SaveOptions,
): Promise<AgentlineConfig> {
  return persist((cfg) => setWidgetOption(cfg, spec), opts);
}

export function saveSetRefreshInterval(
  seconds: number,
  opts?: SaveOptions,
): Promise<AgentlineConfig> {
  return persist((cfg) => setRefreshInterval(cfg, seconds), opts);
}

/**
 * Load the merged config, apply `mutate`, validate, and atomically write the
 * result to the user config path. The full merged tree is materialised on
 * disk — the same shape the TUI editor writes via `saveEditedConfig`.
 *
 * The whole load → mutate → write cycle runs under `withFileLock` so two
 * concurrent CLI invocations (e.g. `agentline config widget add` racing
 * `agentline config refresh`) can't read the same on-disk config, apply
 * independent mutations, and silently lose one writer's changes when the
 * second `writeJsonIdempotent` lands last.
 */
async function persist(
  mutate: (cfg: AgentlineConfig) => AgentlineConfig,
  opts?: SaveOptions,
): Promise<AgentlineConfig> {
  const env = resolveEnv(opts ?? {});
  const userConfig = resolveConfigPaths(env).userConfig;
  return withFileLock(userConfig, async () => {
    const { config } = await loadConfig({ env });
    const next = mutate(config);
    validateConfig(next);
    await writeJsonIdempotent(userConfig, next);
    return next;
  });
}

// ─── internals ──────────────────────────────────────────────────────────────

function assertWidgetType(type: unknown): void {
  if (typeof type !== "string" || type.trim() === "") {
    throw new ConfigMutationError("widget type must be a non-empty string");
  }
  if (!(type in WIDGET_CATALOG)) {
    throw new ConfigMutationError(`unknown widget type '${type}'`);
  }
}

function assertLineWithinCap(line: number, op: string): void {
  if (!Number.isInteger(line) || line < 0) {
    throw new ConfigMutationError(`${op}: line index must be a non-negative integer (got ${line})`);
  }
  if (line >= MAX_LINES) {
    throw new ConfigMutationError(`${op}: line index ${line} exceeds the ${MAX_LINES}-line limit`);
  }
}

function requireLine(lines: LineConfig[], line: number, op: string): LineConfig {
  if (!Number.isInteger(line) || line < 0 || line >= lines.length) {
    throw new ConfigMutationError(
      `${op}: no line at index ${line} (config has ${lines.length} line${lines.length === 1 ? "" : "s"})`,
    );
  }
  const out = lines[line];
  if (!out) throw new ConfigMutationError(`${op}: no line at index ${line}`);
  return out;
}

function requireWidget(line: LineConfig, at: number, lineIndex: number): WidgetConfig {
  requireWidgetIndex(line.widgets.length, at, lineIndex);
  const widget = line.widgets[at];
  if (!widget) throw new ConfigMutationError(`no widget at index ${at} on line ${lineIndex}`);
  return widget;
}

function requireWidgetIndex(count: number, at: number, line: number): void {
  if (!Number.isInteger(at) || at < 0 || at >= count) {
    throw new ConfigMutationError(
      `no widget at index ${at} on line ${line} (line has ${count} widget${count === 1 ? "" : "s"})`,
    );
  }
}

function assertInsertIndex(at: number, count: number, line: number): void {
  if (!Number.isInteger(at) || at < 0 || at > count) {
    throw new ConfigMutationError(
      `insert index ${at} out of range on line ${line} (valid: 0..${count})`,
    );
  }
}

/**
 * Deep-copy `lines`, padding with empty lines up to `ensureLine` (when
 * given) so the caller can index it directly. Padding stays within
 * `MAX_LINES`; callers validate that first.
 */
function cloneLines(lines: readonly LineConfig[], ensureLine?: number): LineConfig[] {
  assertValidLineIndex(ensureLine);
  const out: LineConfig[] = lines.map((line) => ({
    widgets: line.widgets.map(cloneWidget),
  }));
  if (ensureLine !== undefined) {
    while (out.length <= ensureLine) out.push({ widgets: [] });
  }
  return out;
}

function cloneWidget(widget: WidgetConfig): WidgetConfig {
  return structuredClone(widget);
}
