/**
 * Embedded render fixture for D10.
 *
 * Pins the bin's render path to a known input → output pair so doctor
 * catches accidental drift in the rendering surface even when the
 * user has no goldens of their own. Input goes through the real
 * pipeline (`renderForFixture`); the expected bytes match the
 * default config rendering `claude-doctor-fixture` through the
 * `model` widget under no-colour mode.
 */

const FIXTURE_INPUT = JSON.stringify({
  model: "claude-doctor-fixture",
  cwd: "/agentline/doctor/fixture",
});
const FIXTURE_EXPECTED = "claude-doctor-fixture\n";

export interface FixtureOutcome {
  match: boolean;
  detail: string;
}

export async function runEmbeddedRenderFixture(): Promise<FixtureOutcome> {
  const { renderForFixture } = await import("../render/fixture-runner.js");
  try {
    const actual = await renderForFixture(FIXTURE_INPUT, {
      env: { ...process.env, NO_COLOR: "1" },
      flags: { noColor: true, noUnicode: false },
    });
    if (actual === FIXTURE_EXPECTED) {
      return { match: true, detail: "ok" };
    }
    return {
      match: false,
      detail: `expected ${JSON.stringify(FIXTURE_EXPECTED)}, got ${JSON.stringify(actual)}`,
    };
  } catch (err) {
    return { match: false, detail: `render threw: ${(err as Error).message}` };
  }
}
