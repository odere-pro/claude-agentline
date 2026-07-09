# Golden tests (§11.3)

Each subdirectory is a scenario: a stdin payload + config + frozen
clock paired with the exact bytes the renderer must emit.

## Layout

| File            | Contents                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stdin.json`    | The Claude Code statusline JSON payload.                                                                                                                       |
| `config.json`   | An `AgentlineConfig` (overrides the default).                                                                                                                  |
| `clock.txt`     | Single-line ISO timestamp the renderer freezes time at.                                                                                                        |
| `expected.ansi` | Exact bytes (escapes + text) the renderer must produce.                                                                                                        |
| `git.json`      | _Optional._ A serialized `GitState` injected as a static snapshot so git widgets render deterministically (no real `git`/`gh`). Omit it for non-git scenarios. |

## Synthetic git (`git.json`)

A git widget hides unless `ctx.git` is populated, and loading real git in a
golden would be non-deterministic. So a scenario may carry an optional
`git.json` — a hand-authored, static `GitState`. Both the source harness
(`src/render/render/__golden__.test.ts`) and the published bin
(`render --fixture --git <path>`, exercised by `gate-12`) read that file
through the same parser (`src/render/render/fixture/parse-git-fixture.ts`),
so they inject byte-identical snapshots. `--git` requires `--fixture` — an
injected snapshot must never reach the live statusline. See `git-pr-host-pr/`
(a `prSource: "host"` PR renders by default), `git-pr-network-no-optin/` (a
`prSource: "network"` PR hides without `allowNetwork`), and
`git-pr-network-optin/` (the same network PR renders once `allowNetwork: true`
is set).

> **Lockstep:** `git-pr-network-no-optin/git.json` and
> `git-pr-network-optin/git.json` are intentionally byte-identical — the only
> difference between the two scenarios is `allowNetwork` in their `config.json`.
> If you edit one `git.json`, edit the other to match, or the pair stops
> isolating the opt-in toggle.

To author a `git.json`, **start from an existing one**
(`cp tests/golden/git-pr-host-pr/git.json …`) and edit it — the full shape is
`GitState` in `src/data/git/snapshot/snapshot.ts`. The parser validates the
`available` discriminant, the required sub-objects, and that `pr`/`prSource`
move together, but it does **not** check every field name, so a misspelled key
(`prsource`, `aheadbehind`) surfaces as a wrong golden, not an error — diff
`expected.ansi` to confirm the render is what you intended.

## Harness

`src/render/render/__golden__.test.ts` walks every scenario under
`tests/golden/`, feeds the inputs through `renderForFixture`, and
diffs the output against `expected.ansi`. T3 ships
`gate-12-render-determinism.sh` separately; the gate runs the
binary once per scenario and asserts the same byte-for-byte match.

## Adding a scenario

```bash
mkdir tests/golden/my-scenario
cat <<'JSON' > tests/golden/my-scenario/stdin.json
{ "model": "claude-opus-4-7" }
JSON
cat <<'JSON' > tests/golden/my-scenario/config.json
{
  "version": 1,
  "theme": null,
  "lines": [{ "widgets": [{ "type": "model" }] }],
  "global": { "padding": 1, "separator": "|", "inheritColors": false,
              "bold": false, "italic": false, "minimalist": false,
              "overrideFg": null, "overrideBg": null },
  "powerline": { "enabled": false, "theme": null,
                 "caps": { "start": "", "end": "" },
                 "autoAlign": false, "continueColors": false },
  "keymap": {}
}
JSON
echo "2026-05-01T00:00:00Z" > tests/golden/my-scenario/clock.txt

# For a git-widget scenario only: seed a static GitState from a worked
# example, then edit it (prSource, pr, branch, …).
cp tests/golden/git-pr-host-pr/git.json tests/golden/my-scenario/git.json

# Record with the SAME env gate-12 pins (ascii glyphs + UTC), or the bytes
# won't match the gate. Drop the `--git` line for a non-git scenario.
env NO_COLOR=1 AGENTLINE_GLYPHS=ascii TZ=UTC node dist/cli.mjs render \
    --fixture tests/golden/my-scenario/stdin.json \
    --config  tests/golden/my-scenario/config.json \
    --frozen-clock "$(cat tests/golden/my-scenario/clock.txt)" \
    --git     tests/golden/my-scenario/git.json \
    --width 80 --no-color \
  > tests/golden/my-scenario/expected.ansi
npx vitest run src/render/render/__golden__.test.ts
```
