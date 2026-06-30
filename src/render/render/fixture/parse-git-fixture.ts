/**
 * Shared deserializer for the optional golden `git.json` synthetic-git
 * snapshot (issue #255).
 *
 * Golden scenarios cover the render path deterministically, but no git
 * widget was exercised end-to-end before this: the source harness passed no
 * `git` to `renderForFixture` and the bin's `render --fixture` path never
 * loaded a snapshot, and loading *real* git would be non-deterministic. The
 * fix is to let a scenario carry a hand-authored, static `GitState` in a
 * sibling `git.json` and inject it — no `git`/`gh` ever runs.
 *
 * Both the source harness (`__golden__.test.ts`) and the bin's
 * `render --fixture --git <path>` read that file through THIS one helper, so
 * the two sides inject byte-identical snapshots — parity is structural, not
 * a convention each call site must independently uphold.
 *
 * The parse boundary applies the reserved-meta-key strip every JSON-parse
 * site uses (D-010), then validates the `available` discriminant and — for an
 * available snapshot — that the sub-objects every git widget dereferences are
 * present and that `pr`/`prSource` move together (the snapshot invariant
 * `prSource === null iff pr === null`). A partial or inconsistent snapshot
 * therefore fails loud here, with a clean error the caller surfaces, rather
 * than crashing a dependent widget to empty output or rendering `undefined`
 * into a misleading golden. Field *values* beyond that stay the scenario
 * author's responsibility — a wrong value surfaces as a golden diff. The
 * returned value is shallow-frozen to mirror the snapshot the live loader
 * produces.
 */

import { isPlainObject } from "../../../core/lib/object/object.js";
import { stripPrototypeKeys } from "../../../core/lib/strip-prototype-keys/strip-prototype-keys.js";
import type { GitState } from "../../../data/git/index.js";

/**
 * The object-valued fields an available `GitSnapshot` always carries and that
 * git widgets dereference directly (`changes.ts` reads `diff.insertions`,
 * `ahead-behind` reads `aheadBehind.ahead`, …). Their absence would throw
 * inside a widget — caught here instead so the failure is loud and local.
 */
const REQUIRED_SNAPSHOT_OBJECTS = ["status", "diff", "diffStaged", "aheadBehind"] as const;

function isSet(value: unknown): boolean {
  return value !== null && value !== undefined;
}

/**
 * Parse a serialized `GitState` from a `git.json` fixture body. Throws on
 * invalid JSON, a non-boolean `available`, a partial available snapshot, or a
 * `pr`/`prSource` mismatch; callers surface a clean diagnostic.
 */
export function parseGitFixture(raw: string): GitState {
  const parsed = stripPrototypeKeys(JSON.parse(raw));
  if (!isPlainObject(parsed) || typeof parsed.available !== "boolean") {
    throw new Error("git fixture must be a JSON object with a boolean `available` field");
  }
  if (parsed.available === true) {
    for (const key of REQUIRED_SNAPSHOT_OBJECTS) {
      if (!isPlainObject(parsed[key])) {
        throw new Error(`git fixture: an available snapshot must carry an object \`${key}\``);
      }
    }
    // A `pr` without a `prSource` would render ungated; reject the mismatch.
    if (isSet(parsed.pr) !== isSet(parsed.prSource)) {
      throw new Error("git fixture: `pr` and `prSource` must both be set or both be null");
    }
  }
  return Object.freeze(parsed) as unknown as GitState;
}
