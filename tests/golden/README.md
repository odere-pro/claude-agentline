# Golden tests (§11.3)

Each subdirectory is a scenario: a stdin payload + config + frozen
clock paired with the exact bytes the renderer must emit.

## Layout

| File             | Contents                                                       |
| ---------------- | -------------------------------------------------------------- |
| `stdin.json`     | The Claude Code statusline JSON payload.                       |
| `config.json`    | An `AgentlineConfig` (overrides the default).                  |
| `clock.txt`      | Single-line ISO timestamp the renderer freezes time at.        |
| `expected.ansi`  | Exact bytes (escapes + text) the renderer must produce.        |

## Harness

`src/render/__golden__.test.ts` walks every scenario under
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
  "terminalWidth": { "mode": "full", "compactThreshold": 60 },
  "keymap": {}
}
JSON
echo "2026-05-01T00:00:00Z" > tests/golden/my-scenario/clock.txt
node dist/cli.mjs render \
    --fixture tests/golden/my-scenario/stdin.json \
    --config  tests/golden/my-scenario/config.json \
    --frozen-clock "$(cat tests/golden/my-scenario/clock.txt)" \
    --no-color \
  > tests/golden/my-scenario/expected.ansi
npx vitest run src/render/__golden__.test.ts
```
