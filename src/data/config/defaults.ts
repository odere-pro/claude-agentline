import type { AgentlineConfig } from "./types.js";

export const DEFAULT_COMPACT_THRESHOLD = 60;

/**
 * Built-in defaults — layer 1 of the merge order (§4.1).
 *
 * Only spec-defined defaults from §4.4, §4.5, §5.1 are encoded here.
 * The shipped widget list lives in `templates/default.config.json`
 * (§4.8), not in code; binding the default line into the binary
 * would force a rebuild for every widget tweak.
 */
export const DEFAULT_CONFIG: AgentlineConfig = {
  version: 1,
  theme: null,
  lines: [{ widgets: [{ type: "model" }] }],
  global: {
    padding: 1,
    separator: "|",
    inheritColors: false,
    bold: false,
    italic: false,
    minimalist: false,
    overrideFg: null,
    overrideBg: null,
  },
  powerline: {
    enabled: false,
    theme: null,
    caps: { start: "", end: "" },
    autoAlign: false,
    continueColors: false,
  },
  terminalWidth: {
    mode: "full-minus-40",
    compactThreshold: DEFAULT_COMPACT_THRESHOLD,
  },
  keymap: {},
  language: "en",
  families: {},
  translations: {},
};
