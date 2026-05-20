# CLAUDE.md — `src/data/config`

> Leaf deep-dive. The group-level boundary rules live in `src/data/CLAUDE.md`; this file is the hard, config-specific contract. Read both.

## Scope

This leaf owns one thing: turning the merge layers into a single trusted `AgentlineConfig`, and being the only place that writes that config back to disk. Concretely: layer discovery and merge (`load.ts`, `merge.ts`, `env.ts`, `defaults.ts`), schema validation (`validate.ts`), pure immutable mutation operations plus their disk wrappers (`mutate.ts`), the global config path resolution (`paths.ts`), the type mirror of the schema (`types.ts`), and the scriptable `config widget` verbs (`widget/`, `widget-command.ts`).

## Local setup

```sh
pnpm exec vitest run src/data/config
```

No golden or fixture prerequisite. Every loader and disk wrapper takes an explicit `env` argument, so tests resolve paths inside a tmp dir and never touch the real `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/`. Pass `skipValidation: true` to `loadConfig` only in tests that deliberately exercise pre-validation shapes.

## Invariants you must not break

- **Layer order is fixed and weakest-first:** built-in `DEFAULT_CONFIG` → user file (`${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`) → `AGENTLINE_*` env override → caller flag overrides. `load.ts` encodes this order in one `mergeAll` call; do not reorder, and do not add a fifth layer without updating the cookbook.
- **Global-only. There is no per-project layer.** A `.agentline.json` in the cwd is silently ignored — there is no code path that reads it, and there must not be one. `paths.ts` resolves exactly one user config location.
- **Validation runs AFTER the full merge and BEFORE any atomic write.** `load.ts` merges all layers, then `validateConfig(merged)`. `mutate.ts` `persist()` does load → mutate → `validateConfig(next)` → atomic write. A broken config must never reach disk and must never reach the render path un-validated. Do not validate per-layer here (that is the cookbook's conceptual model; the implementation validates the merged result — keep the implementation note accurate, do not "fix" it to per-layer).
- **The only write path is the atomic helper.** Every persisted config write goes through `writeJsonIdempotent` from `src/core/lib/atomic-write/atomic-write.ts` (write sibling temp → `fsync` → `rename`). Never `fs.writeFile` the user config directly anywhere in this leaf.
- **Mutation helpers are pure.** `addWidget`/`removeWidget`/`replaceWidget`/`moveWidget`/`setWidgetOption`/`setTheme` return a new config via immutable spreads and `structuredClone`; they never touch their input. The `save*` wrappers are the only functions here that do I/O, and they compose the pure op with `persist()`.
- **Reserved keys are stripped before validation, not relied upon to be caught by it.** `merge.ts` and `env.ts` drop `__proto__` / `constructor` / `prototype` during the recursive copy. The strict-root schema would catch top-level cases, but `widget.options` and `palette` are `additionalProperties: true`, so the strip is load-bearing there. Keep both strips.
- **Retired top-level keys are dropped, never hard-failed.** `dropRetiredKeys` in `load.ts` silently removes deliberately-retired keys (currently `glyphs`) before validation so a config from a prior install does not brick the statusline on upgrade. Keys that were _never_ valid still fail. Add to `RETIRED_TOP_LEVEL_KEYS` only when retiring a previously-shipped key.
- **`types.ts` mirrors the schema; the schema is authoritative.** Colour fields are the strict `Colour` union, not `string`. `validate.ts` re-checks colours with `isColour` post-AJV (`narrowColours`) so a future schema loosening cannot leak unvalidated strings into the typed config the render path consumes. Keep that belt-and-braces pass.
- **Arrays replace wholesale on merge.** A user `lines` array overrides the default entirely; partial line edits go through the mutation ops / TUI editor, not the merge layer. `null` is a real value (clears); `undefined` is a no-op.

### Adding a new config field end-to-end

All of the following, in one PR, or the field is half-wired:

1. **Schema** — add it to `schemas/config.schema.json` (the authoritative source). Respect the strictness rules: root stays `additionalProperties: false`.
2. **Type** — mirror it in `src/data/config/types.ts` (and `PartialAgentlineConfig` if it is mergeable).
3. **Default** — add a spec-defined default to `DEFAULT_CONFIG` in `defaults.ts` (layer 1).
4. **Validation** — if it is a colour or has a cross-field constraint, extend `narrowColours` / the schema's custom keywords accordingly.
5. **Test** — cover merge precedence (default vs user vs env vs flag), schema rejection of a bad value, and the env-override dot-path decode if applicable.

## Applied patterns

→ `docs/cookbook/05-design-patterns.md`

- **Layered immutable config merge** — one merged, frozen-for-the-tick config; schema violations surface against the merged result.
- **Schema-first contracts** — the validator runs before any other code touches the parsed JSON.
- **Atomic file write** — torn config at editor-kill time would brick the statusline; rename shrinks the failure window to "killed between temp and rename".
- **Reserved-meta-key strip at every JSON parse boundary** — closes the `additionalProperties: true` carve-out the strict root cannot.

## Tradeoffs

→ `docs/cookbook/10-tradeoffs-and-decisions.md`

- **D-004** — no per-project layer: one source of truth, trading away per-repo theming.
- **D-007** — schema-versioned config: a newer schema is refused, not half-migrated.
- **D-010** — the recursive reserved-key strip is cheap insurance over relying solely on the strict root.

## How to test this area

- `pnpm exec vitest run src/data/config` — `merge.test.ts` (right-wins, array-replace, `null` vs `undefined`, prototype-key drop), `load.test.ts` (layer precedence, missing-file skip, retired-key drop, invalid-JSON error message), `env.test.ts` (dot-path decode, JSON-vs-raw values), `validate.test.ts` (strict unknown-key rejection, post-AJV colour narrowing), `mutate.test.ts` / `widget/*.test.ts` (pure-op bounds, immutability, disk-wrapper round-trips). Failure mode guarded: a config that would brick the statusline or leak unvalidated data into the render path.
- `gate-11-schema-roundtrip.sh` — the shipped config template validates against the schema; failure mode is template/schema drift.

## When in doubt

Owning chapters: `docs/cookbook/04-architecture.md` (render pipeline stages 3, state surfaces, failure model), `06-data-contracts.md`, `05-design-patterns.md`. Config and type vocabulary is defined in `docs/GLOSSARY.md` (authoritative) — refer, do not restate. If the docs are silent, open an issue rather than inventing behaviour.
