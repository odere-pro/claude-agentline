/**
 * Public surface of the config layer (§4).
 *
 * The render path imports from here; subcommand entry-points reach into
 * `validate`, `atomic`, or `paths` directly when they need the lower-level
 * pieces.
 */

export { loadConfig, type LoadOptions, type LoadedConfig } from "./load.js";
export { atomicWrite, atomicWriteJson, type AtomicWriteOptions } from "./atomic.js";
export { resolveConfigPaths, type ConfigPaths } from "./paths.js";
export { validateConfig, ConfigValidationError } from "./validate.js";
export { DEFAULT_CONFIG } from "./defaults.js";
export { deepMerge, mergeAll } from "./merge.js";
export { envLayer } from "./env.js";
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
  Colour,
} from "./types.js";
