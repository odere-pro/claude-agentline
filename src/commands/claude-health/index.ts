/**
 * Claude-CLI health refresher — the off-render-path worker that probes the
 * host `claude` CLI and writes the claude-health cache. Network + subprocess
 * live here (same boundary as `update-check/`), never on the render path.
 */

export {
  maybeRefreshClaudeHealth,
  type ClaudeHealthRefreshOutcome,
  type MaybeRefreshClaudeHealthOptions,
} from "./refresh/refresh.js";
export { parseClaudeDoctor, parseClaudeVersion } from "./parse/parse.js";
