// Jazzer.js fuzz target: config validator.
// Mirrors tests/fuzz/config-validate.fuzz.test.ts. Arbitrary JSON is fed
// to validateConfig, which must either accept or reject with the typed
// ConfigValidationError — any other throw is a finding.

const { validateConfig, ConfigValidationError } = require("./bundle.cjs");

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
  try {
    validateConfig(parsed);
  } catch (err) {
    if (err instanceof ConfigValidationError) return;
    throw err;
  }
};
