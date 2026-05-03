/**
 * Embedded render fixture for D10.
 *
 * The fixture pins the bin's render path to a known input → output pair so
 * that doctor catches accidental drift in the rendering surface even when
 * the user has no goldens of their own. The bytes here intentionally match
 * the minimal `src/cli.ts` default render (`<model> · <cwd>\n`); when
 * the full render pipeline lands the snapshot is updated atomically with
 * that PR so D10 keeps tracking truth.
 */

const FIXTURE_INPUT = JSON.stringify({
  model: "claude-doctor-fixture",
  cwd: "/agentline/doctor/fixture",
});
const FIXTURE_EXPECTED = "claude-doctor-fixture · /agentline/doctor/fixture\n";

export interface FixtureOutcome {
  match: boolean;
  detail: string;
}

export async function runEmbeddedRenderFixture(): Promise<FixtureOutcome> {
  const { renderForFixture } = await import("../render/fixture-runner.js");
  try {
    const actual = await renderForFixture(FIXTURE_INPUT);
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
