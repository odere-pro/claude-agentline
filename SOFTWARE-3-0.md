# SOFTWARE-3-0.md

**New here, and human?** → `README.md` quickstart; keep `docs/GLOSSARY.md` open.

**New here, and an agent?** → your dispatch surface is `agents/`; read `CLAUDE.md`,
then the per-group `CLAUDE.md` for the area you edit.

**Division of labour:** `CLAUDE.md` is the entry point (what/where); this file is
the thesis (the why). This file is dev-time only — it is not shipped in the npm
package.

---

## Thesis

Karpathy names three eras: Software 1.0 (human-authored rules), Software 2.0
(learned weights), Software 3.0 (LLMs as runtime, prompts as program). The
relevant design question for 3.0 is not "did an LLM help write this?" but: **is
the product reachable by an agent without a human in the loop?**

Agentline is a CLI statusline tool whose hot path contains no language model. Yet
every architectural decision — the versioned stdin contract, the flat CLI verb
table, the seeded skill files, the per-group briefings, the authoritative
vocabulary — flows from one constraint: an LLM agent must be able to install,
configure, theme, and troubleshoot agentline using only natural language, the
user's terminal, and what the repo ships. The product is
[agent-operable](docs/GLOSSARY.md) not by containing an agent but by providing a
surface an agent can drive.

---

## Surface map

A row missing either on-ramp is a defect (the **parity rule** — see
`docs/GLOSSARY.md`).

| Surface                      | Human on-ramp                                                                                              | Agent on-ramp                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Docs**                     | [`docs/`](docs/) + [`docs/cookbook/`](docs/cookbook/)                                                      | `CLAUDE.md` + <!-- agentline:count name="claude-md" -->18<!-- /agentline:count --> per-group `CLAUDE.md` briefings |
| **Tools (CLI verbs)**        | [`README.md`](README.md) · [`docs/get-started.md`](docs/get-started.md)                                    | `agentline help`; `COMMANDS` table in `src/cli/cli.ts`; `--json` on `list`/`catalog`/`doctor`                      |
| **Agents / skills dispatch** | [`agents/`](agents/) — <!-- agentline:count name="agents-skills" -->5<!-- /agentline:count --> skill files | `description:` frontmatter **dispatch contract** of `agents/*.md` (see `agents/CLAUDE.md`)                         |
| **Config / mutation**        | `agentline edit` (TUI)                                                                                     | `agentline config widget …` → `src/data/config/`                                                                   |
| **Design / architecture**    | [`docs/cookbook/04-architecture.md`](docs/cookbook/04-architecture.md)                                     | Import-direction diagram in `CLAUDE.md`; per-group `CLAUDE.md` files                                               |
| **State / persistence**      | State section of [`docs/cookbook/04-architecture.md`](docs/cookbook/04-architecture.md)                    | `src/data/state/` + `src/data/state/CLAUDE.md` (render cache, stdin cache, backup)                                 |
| **Quality / contract**       | [`docs/cookbook/14-gates-catalogue.md`](docs/cookbook/14-gates-catalogue.md)                               | `tests/gates/` + `docs/GLOSSARY.md`                                                                                |

The cold-start budget is enforced by gate-13 (`tests/gates/gate-13-cold-start-budget.sh`).

---

## Context-planner

| Task                        | Read first                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Add or change a widget      | `src/widgets/CLAUDE.md` + [`docs/cookbook/07-component-specs.md`](docs/cookbook/07-component-specs.md) |
| Change the render path      | `src/render/render/CLAUDE.md` + [`docs/cookbook/04-architecture.md`](docs/cookbook/04-architecture.md) |
| Add or update a gate        | `tests/gates/CLAUDE.md` + [`docs/cookbook/14-gates-catalogue.md`](docs/cookbook/14-gates-catalogue.md) |
| Theme work                  | `themes/` + `agents/agentline-themes.md` + [`docs/themes.md`](docs/themes.md)                          |
| Install / uninstall / reset | `src/commands/CLAUDE.md` + `agents/CLAUDE.md`                                                          |
| Config mutation API         | `src/data/config/` + `src/data/state/CLAUDE.md`                                                        |

---

## Worked example

User asks Claude Code: _"switch agentline to a high-contrast theme."_

1. The host matches the request to `agents/agentline-themes.md` via its `description:` dispatch contract.
2. The skill directs Claude to inspect `themes/` for shipped themes and read the current layout with `agentline config widget list --json`.
3. Claude mutates the config — via `agentline config widget` verbs or `agentline edit` — and saves atomically.
4. `agentline doctor` confirms host wiring is intact.
5. The next prompt cycle re-invokes the bin; the new theme renders.

No new endpoint, no new agent framework. Five steps, each backed by an explicit contract.

---

## Where to read next

- `CLAUDE.md` — repo entry-point briefing (what/where).
- `docs/GLOSSARY.md` — authoritative vocabulary.
- [`docs/cookbook/04-architecture.md`](docs/cookbook/04-architecture.md) — hot path, cold path, state surfaces.
- [`docs/cookbook/08-feature-catalogue.md`](docs/cookbook/08-feature-catalogue.md) — shipped widgets, themes, verbs, skill files.
- [`docs/cookbook/14-gates-catalogue.md`](docs/cookbook/14-gates-catalogue.md) — every gate and what it probes.
- [`docs/cookbook/16-release-and-versioning.md`](docs/cookbook/16-release-and-versioning.md) — skill-file lifecycle, schema migration, release contract.

If the docs are silent on something an agent needs, treat that as a bug. The
product is the docs plus the code; one without the other is not Software 3.0.
