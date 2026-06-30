/**
 * Golden tests harness (§11.3).
 *
 * Walks every scenario under `tests/golden/`, feeds the inputs
 * through `renderForFixture`, and diffs the output against the
 * recorded `expected.ansi`. T3 ships `gate-12-render-determinism.sh`
 * separately to run the same comparison through the published bin
 * — the source-side harness here catches drift inside the
 * unit-test loop without waiting for a build.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { renderForFixture } from "./fixture/fixture-runner.js";
import { parseGitFixture } from "./fixture/parse-git-fixture.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_ROOT = resolve(__dirname, "..", "..", "..", "tests", "golden");

interface Scenario {
  readonly name: string;
  readonly stdinPath: string;
  readonly configPath: string;
  readonly clockPath: string;
  readonly expectedPath: string;
  /**
   * Optional sibling `git.json` — a serialized `GitState` injected so git
   * widgets render deterministically (no real `git`/`gh`). The bin path
   * (gate-12) reads the same file via `render --fixture --git`, keeping the
   * source harness and the published bin in parity (#255).
   */
  readonly gitPath?: string;
}

function findScenarios(): readonly Scenario[] {
  if (!existsSync(GOLDEN_ROOT)) return [];
  const out: Scenario[] = [];
  for (const entry of readdirSync(GOLDEN_ROOT)) {
    const dir = resolve(GOLDEN_ROOT, entry);
    if (!statSync(dir).isDirectory()) continue;
    const stdinPath = resolve(dir, "stdin.json");
    const configPath = resolve(dir, "config.json");
    const clockPath = resolve(dir, "clock.txt");
    const expectedPath = resolve(dir, "expected.ansi");
    if (
      !existsSync(stdinPath) ||
      !existsSync(configPath) ||
      !existsSync(clockPath) ||
      !existsSync(expectedPath)
    ) {
      continue;
    }
    const gitPath = resolve(dir, "git.json");
    out.push({
      name: entry,
      stdinPath,
      configPath,
      clockPath,
      expectedPath,
      ...(existsSync(gitPath) ? { gitPath } : {}),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const scenarios = findScenarios();

describe("golden render scenarios", () => {
  it("scenarios are present", () => {
    expect(scenarios.length).toBeGreaterThan(0);
  });

  for (const scenario of scenarios) {
    it(`${scenario.name} renders the expected bytes`, async () => {
      const stdin = readFileSync(scenario.stdinPath, "utf8");
      const clockISO = readFileSync(scenario.clockPath, "utf8").trim();
      const expected = readFileSync(scenario.expectedPath, "utf8");
      const actual = await renderForFixture(stdin, {
        configPath: scenario.configPath,
        frozenClockISO: clockISO,
        /*
         * Lock env to a minimal, host-independent shape so goldens
         * are byte-identical on every machine. ASCII glyphs keep
         * Powerline scenarios reproducible without a Nerd Font.
         * TZ=UTC prevents wall-clock-anchored widgets from drifting
         * across machines/timezones (Bug 6 / CI incident).
         */
        env: { NO_COLOR: "1", AGENTLINE_GLYPHS: "ascii", TZ: "UTC" },
        flags: { noColor: true, noUnicode: false },
        width: 80,
        // Inject the scenario's synthetic git snapshot when present, through
        // the same parser the bin uses — so git widgets are exercised
        // deterministically and the source harness matches gate-12 byte-for-byte.
        ...(scenario.gitPath
          ? { git: parseGitFixture(readFileSync(scenario.gitPath, "utf8")) }
          : {}),
      });
      expect(actual).toBe(expected);
    });
  }
});
