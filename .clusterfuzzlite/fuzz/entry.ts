/**
 * Single bundle entry for the ClusterFuzzLite / OSS-Fuzz harnesses.
 *
 * The shipped `dist/` is a bundled CLI (`cli.mjs`) with no per-module
 * exports, so the fuzz build (`.clusterfuzzlite/build.sh`) bundles this
 * file to `bundle.cjs` and the Jazzer.js targets require the parsers from
 * there. Keep the exports in sync with `tests/fuzz/` and
 * `docs/oss-fuzz-application.md`.
 */

export { adaptStatuslinePayload, StdinParseError } from "../../src/core/stdin/index.js";
export { ConfigValidationError, validateConfig } from "../../src/data/config/validate/validate.js";
export {
  clearTranscriptCache,
  readTranscript,
} from "../../src/data/tokens/transcript/transcript.js";
