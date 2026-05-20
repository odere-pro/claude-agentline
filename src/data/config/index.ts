/**
 * Public surface of the config subsystem (§4).
 *
 * The render path imports from here; subcommand entry-points reach into
 * `validate`, `atomic`, or `paths` directly when they need the lower-level
 * pieces.
 */

export { loadConfig } from "./load/load.js";
export { DEFAULT_CONFIG } from "./defaults/defaults.js";
export type { AgentlineConfig } from "./types.js";
