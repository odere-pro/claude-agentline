// Jazzer.js fuzz target: stdin contract parser.
// Mirrors tests/fuzz/stdin-json.fuzz.test.ts. The data buffer is treated
// as the raw stdin bytes; the parser must either adapt them or fail with
// the typed StdinParseError — any other throw is a finding.

const { adaptStatuslinePayload, StdinParseError } = require("./bundle.cjs");

/**
 * @param {Buffer} data
 */
module.exports.fuzz = function (data) {
  let parsed;
  try {
    parsed = JSON.parse(data.toString("utf8"));
  } catch {
    return; // malformed JSON is expected, not a finding
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return;
  }
  try {
    adaptStatuslinePayload(parsed);
  } catch (err) {
    if (err instanceof StdinParseError) return;
    throw err;
  }
};
