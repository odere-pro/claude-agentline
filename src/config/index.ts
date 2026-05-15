/**
 * Public surface of the config subsystem (§4).
 *
 * The render path imports from here; subcommand entry-points reach into
 * `validate`, `atomic`, or `paths` directly when they need the lower-level
 * pieces.
 */

export { loadConfig, type LoadOptions, type LoadedConfig } from "./load.js";
export {
  writeIdempotent,
  writeJsonIdempotent,
  writeOnce,
  type AtomicWriteOptions,
} from "../lib/atomic-write.js";
export { resolveConfigPaths, type ConfigPaths } from "./paths.js";
export { validateConfig, ConfigValidationError } from "./validate.js";
export { DEFAULT_CONFIG } from "./defaults.js";
export { deepMerge, mergeAll } from "./merge.js";
export { envLayer } from "./env.js";
export {
  MAX_LINES,
  ConfigMutationError,
  addWidget,
  removeWidget,
  replaceWidget,
  moveWidget,
  setWidgetOption,
  setTheme,
  saveAddWidget,
  saveRemoveWidget,
  saveReplaceWidget,
  saveMoveWidget,
  saveSetWidgetOption,
  type AddWidgetSpec,
  type RemoveWidgetSpec,
  type ReplaceWidgetSpec,
  type MoveWidgetSpec,
  type SetWidgetOptionSpec,
  type SaveOptions,
} from "./mutate.js";
export type {
  AgentlineConfig,
  PartialAgentlineConfig,
  WidgetConfig,
  LineConfig,
  GlobalConfig,
  PowerlineConfig,
  PowerlineCaps,
  PowerlineGlyphs,
  TerminalWidthConfig,
  RawColour,
} from "./types.js";
