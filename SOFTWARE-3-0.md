# SOFTWARE-3-0.md

A thesis: agentline is shaped, end-to-end, so that **agents are first-class operators** of the finished product. This file names that thesis in Andrej Karpathy's vocabulary and points at the parts of the codebase that make it concrete.

## The framing

Karpathy's three eras of software, in one paragraph each:

- **Software 1.0** — code humans write in a programming language. Behaviour is whatever the source says it is.
- **Software 2.0** — neural-network weights learned from data ("Software 2.0", 2017). The "program" is the parameter tensor; humans curate the data and the loss, not the rules.
- **Software 3.0** — LLMs as the runtime, natural-language prompts as the program. The interesting design surface moves outward, to the **interfaces an LLM can drive**: stable input contracts, scriptable verbs, machine-readable descriptions, and docs the model can actually consult mid-task.

Software 3.0 is not "did an LLM help write this code?". It is: **is the product reachable by an agent without a human in the loop?**

## The thesis

Agentline is a CLI statusline tool for Claude Code. It is not branded as an "AI" product and its hot path contains no language model. But every architectural decision — the input contract, the CLI verb set, the shipped subagent skill files, the per-group `CLAUDE.md` briefings, the gates — flows from one constraint:

> An LLM should be able to install, configure, theme, and troubleshoot agentline using only natural language, the user's terminal, and what the repo ships.

The product becomes Software 3.0 by being **agent-operable**, not by containing an agent.

## The five pillars

### 1 · Stable contract at the input boundary

The renderer reads a versioned, bounded JSON envelope on stdin and produces ANSI bytes on stdout. Both halves are stable for an agent to reason about.

- `src/core/stdin/index.ts` — parses Claude Code's stdin payload up to a 256 KB cap; preserves unknown fields untouched on `raw`; stamps `STATUSLINE_TRANSLATOR_VERSION` (currently `1`) on every payload (`index.ts:33`).
- The adapter — `adaptStatuslinePayload` — is the only place that absorbs host drift. Render-path code consumes the typed `StdinPayload`; the rest of the codebase never re-parses.
- `docs/cookbook/06-data-contracts.md` documents the inbound shape stack-agnostically so an agent (or a future re-implementation) can reproduce it without reading the source.

If Claude Code changes the envelope tomorrow, only the adapter changes. The agent's mental model of "what comes in" stays valid.

### 2 · Scriptable CLI verb surface

`src/cli/cli.ts` exposes a deliberately **flat** verb table (`COMMANDS`, around `cli.ts:200`). No nested dispatchers. Every verb is reachable from a single `--help` view.

| Verb              | What an agent does with it                                 |
| ----------------- | ---------------------------------------------------------- |
| `render`          | Replay a stdin payload (default no-arg path).              |
| `edit`            | Open the TUI editor (cold path; lazy-imports ink + react). |
| `doctor [--fix]`  | Diagnose host wiring; `--fix` repairs D01–D04.             |
| `reset`           | Reset to shipped defaults + rewire `statusLine`.           |
| `uninstall`       | Reverse install byte-for-byte.                             |
| `config widget …` | Programmatic layout edits (next pillar).                   |
| `config refresh`  | Get/set the statusline refresh cadence.                    |
| `version` `help`  | Self-describing surface.                                   |

`install` is dispatched but hidden from `--help` because `reset` is the agent-facing way to (re)apply defaults (`cli.ts:227-234`).

### 3 · Programmable config-mutation API

The full layout is editable via the `config widget` subgroup (`src/data/config/widget-command/widget-command.ts:64-72`):

- `list [--json]` — read back the current layout.
- `catalog [--json]` — list every shipped widget with `description:` and supported variants.
- `add <type> [--line N] [--at I] [--options JSON]`
- `remove [--line N] --at I`
- `move [--from-line N] --from-at I [--to-line M] [--to-at J]`
- `replace <type> [--line N] --at I [--options JSON]`
- `set-option <key> <value> [--line N] --at I [--json]`

Every mutation is pure (`src/data/config/mutate.ts` returns a new config via immutable spreads), validated against the schema, and written atomically (`writeJsonIdempotent` — write-temp + fsync + `rename`). An agent that gets the path right cannot corrupt the user's config; a broken config is rejected before it reaches disk.

### 4 · Seeded subagent skill files

Five markdown files under `agents/` ship in the package; `agentline install` (step 4 of `scripts/install.sh`, `seed_skills` at line 241+) copies them into `~/.claude/agents/`:

- `agents/agentline.md` — top-level entry: installing, configuring, theming, troubleshooting, doctor.
- `agents/agentline-onboarding.md` — just-installed tour.
- `agents/agentline-configure.md` — layout / widgets / presets / theme / env-var overrides.
- `agents/agentline-themes.md` — theme picker + custom-theme authoring.
- `agents/agentline-troubleshoot.md` — doctor interpretation, symptom-by-symptom runbooks, reset/wipe.

Each file's YAML frontmatter `description:` **is** the dispatch contract — Claude Code routes natural-language requests to the matching file at session start. The product does not implement subagent dispatch; it uses the host's existing system. This is the Software-3.0 move: the product's documentation is also the agent's **import path**.

### 5 · Per-group `CLAUDE.md` briefings + authoritative glossary

Eighteen `CLAUDE.md` files live across the repo (`/CLAUDE.md`, `src/core/CLAUDE.md`, `src/data/CLAUDE.md`, `src/data/config/CLAUDE.md`, `src/data/git/CLAUDE.md`, `src/data/state/CLAUDE.md`, `src/data/tokens/CLAUDE.md`, `src/render/CLAUDE.md`, `src/render/render/CLAUDE.md`, `src/widgets/CLAUDE.md`, `src/widgets/families/CLAUDE.md`, `src/widgets/git/CLAUDE.md`, `src/widgets/tokens/CLAUDE.md`, `src/tui/CLAUDE.md`, `src/tui/tui/CLAUDE.md`, `src/commands/CLAUDE.md`, `tests/gates/CLAUDE.md`, `agents/CLAUDE.md`). Each names scope, boundary rules, applied patterns, and where-to-read-next. An agent that opens any directory has a briefing it can rely on.

`docs/GLOSSARY.md` is authoritative — when a comment, doc, or identifier conflicts with the glossary, the glossary wins. `gate-20`, `gate-21`, and `gate-22` keep documentation, source comments, and derived counts in sync with the glossary. `gate-26` enforces that every translator call uses an id whose English fallback lives in `src/core/i18n/en-dictionary.ts`. Vocabulary stays stable; agent prompts that cite a term keep working release over release.

## Powerline, adapted for agents

A traditional "powerline" is a human visual — chevron-separated coloured segments meant to be glanced at. Agentline's powerline transform (`src/render/powerline/index.ts`, `applyPowerlineLines`) is the same post-compose transform: replace inter-widget separators with chevron pairs and compute adjoining colours. But the surrounding pipeline is adapted so that the **same bytes are equally useful to an agent**:

- **Single-syscall ANSI on stdout.** The render path writes once and exits (`src/render/render/`). An agent that captures stdout has the exact bytes the user saw.
- **Render cache** at `src/data/state/render-cache/` keeps the last successful stdout bytes. An agent can introspect "what is the statusline currently showing?" without re-running the render.
- **Accessibility fallbacks** (`--no-color`, `--no-unicode`, `--ascii`, plus auto colour-depth downgrade) let an agent observe the same widget set in pure ASCII when colour-rendering would confuse parsing. `gate-16` keeps these honest.
- **Deterministic output.** Same stdin + same config + frozen clock ⇒ byte-identical stdout (`docs/cookbook/01 · V3`, `gate-12`). An agent can reason about cause and effect.
- **No network at render time** (`gate-14`) and **no TUI on the render path** (`gate-19`). The observable surface is the ANSI line — nothing else.

The powerline is still pretty for humans. It is also a stable, replayable, parseable side-channel for an LLM.

## The gates that hold the contract

Generic hygiene gates (markdown formatting, shell-lint, etc.) keep the codebase tidy. The gates below specifically protect the agent-operable surface:

| Gate    | Protects                                                                                             |
| ------- | ---------------------------------------------------------------------------------------------------- |
| gate-14 | No network at render time — agents can rely on offline, deterministic renders.                       |
| gate-16 | `--no-color` / `--no-unicode` / `--ascii` fallbacks stay semantically equivalent.                    |
| gate-19 | No TUI/ink/react on the render path — the hot path stays small enough for predictable replay.        |
| gate-20 | Docs use the same vocabulary as the catalogue and glossary.                                          |
| gate-21 | Source comments use the same vocabulary.                                                             |
| gate-22 | Glossary counts and table paths are derived from code, not hand-maintained.                          |
| gate-25 | Layer import direction is enforced — refactors cannot quietly pull cold-path code into the hot path. |
| gate-26 | i18n dictionary contract — every string an agent might see has one canonical English source.         |

Each one removes a class of surprise the agent would otherwise need to defend against.

## A worked example

User asks Claude Code: _"switch agentline to a high-contrast theme."_

1. Claude Code matches the request to `agents/agentline-themes.md` via its frontmatter `description:`.
2. The skill instructs Claude to consult `templates/themes/` for shipped themes and to read the current layout with `agentline config widget list --json`.
3. Claude picks a candidate theme, mutates the user config — either through `agentline edit` (TUI) or by writing the JSON directly under the schema in `src/core/schema/` — and saves atomically.
4. `agentline doctor` confirms host wiring is still intact.
5. Claude Code's next prompt cycle re-invokes the bin; the new theme renders.

No new endpoint, no new agent framework, no eval harness. Five small steps, each backed by an explicit contract.

## Where to read next

- `CLAUDE.md` — repo entry-point briefing.
- `docs/GLOSSARY.md` — authoritative vocabulary (every term in the product is defined exactly once).
- `docs/cookbook/04-architecture.md` — hot path / cold path, state surfaces, failure model.
- `docs/cookbook/08-feature-catalogue.md` — shipped widgets, themes, verbs, and skill files.
- `docs/cookbook/14-gates-catalogue.md` — every gate and what it actually probes.
- `docs/cookbook/16-release-and-versioning.md` — skill-file lifecycle, schema migration, release contract.

If the docs are silent on something an agent needs, treat that as a bug. The product is the docs plus the code; one without the other is not Software 3.0.
