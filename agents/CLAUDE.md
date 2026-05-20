# CLAUDE.md — `agents`

## Scope

The Claude Code **skill files** that ship with `agentline`. On `agentline install`, every `.md` in this directory is copied into `~/.claude/agents/` so Claude Code can load them as assistant skills. `agentline uninstall` reverses the copy (byte-for-byte, by SHA256 checksum).

- `agentline.md` — main briefing; loaded first.
- `agentline-onboarding.md` — first-time-user flow.
- `agentline-configure.md` — configuration guide (widgets, layout, env overrides).
- `agentline-themes.md` — themes (browse, preview, author, colour-depth degradation).
- `agentline-troubleshoot.md` — diagnostic runbook + doctor-check interpretation.

## Map

```
agents/                              ── on `agentline install` ──▶
├── agentline.md                     │   ~/.claude/agents/agentline.md
├── agentline-onboarding.md          │   ~/.claude/agents/agentline-onboarding.md
├── agentline-configure.md           ▶   ~/.claude/agents/agentline-configure.md
├── agentline-themes.md              │   ~/.claude/agents/agentline-themes.md
└── agentline-troubleshoot.md        │   ~/.claude/agents/agentline-troubleshoot.md

  Copy is atomic with a SHA256 checksum; `agentline uninstall` restores byte-for-byte.
  Vocabulary must match docs/GLOSSARY.md (gates 20 / 21).
```

Pattern: **Reversible host-state mutation** (`docs/cookbook/05-design-patterns.md`).

## Invariants you must not break

- **Filename is the destination.** A skill named `agentline-foo.md` lands at `~/.claude/agents/agentline-foo.md`. Rename, and the install command silently changes the host file name too. Do not rename a shipped skill without a migration story.
- **Authoritative vocabulary.** Every term used in a skill must match `docs/GLOSSARY.md`. gate-20 (`docs glossary parity`) rejects retired terms in shipped markdown.
- **Frontmatter format is enforced by the install command.** Each file declares its skill `name`, `description`, and any `tools` allowlist in YAML frontmatter. Changes to the frontmatter shape need a paired update in `src/commands/install/`.
- **No absolute paths.** gate-02 (`no absolute paths in artefacts`) rejects literal `/Users/`, `/home/`, or `~/.claude/` in shipped files. Use `${CLAUDE_CONFIG_DIR}` / `~` placeholders in prose.
- **Skills must not assume the dev repo is present.** A user with `@odere-pro/agentline` installed from npm has no `tests/gates/`, no `src/`, no cookbook. Skill content references the user-facing CLI, the user config file, and `docs/` topics — not the dev repo.
- **Atomic copy + checksummed backup.** The install command copies via `src/core/lib/atomic-write/`; the prior host file (if any) is backed up under `src/data/state/backup/` with a SHA256. `uninstall` restores from that backup byte-for-byte.

## Editing checklist

- [ ] Vocabulary matches `docs/GLOSSARY.md`.
- [ ] No absolute paths.
- [ ] Frontmatter still parses.
- [ ] `npx prettier --write agents/*.md` before commit (gate-05).
- [ ] If renaming a file, update the install command's expectation and add a migration note in the changelog fragment.

## How to test this area

- `node dist/cli.mjs install --from-source` — wires the statusline + copies skill files into the local `~/.claude/agents/` for end-to-end smoke.
- `bash tests/gates/gate-02-no-absolute-paths.sh` — rejects absolute paths in shipped markdown.
- `bash tests/gates/gate-20-glossary-check.sh` — rejects retired vocabulary.
- `bash tests/gates/gate-05-markdown.sh` — markdown formatting.

## When in doubt

Owning chapter: `docs/cookbook/15-documentation-set.md` (doc ownership) and the install/uninstall contracts in `src/commands/CLAUDE.md`.
