# 15 · Documentation set

> **Intent:** For every doc file the project ships, specify target reader, scope, length envelope, what it MUST contain, and what it MUST NOT contain.
> **Reads-with:** `11-repo-layout`.

A doc is a contract with its reader. Length envelopes prevent docs from rotting into walls of stale text.

---

## `README` (repo root)

- **Reader.** A first-time visitor evaluating whether to use the product.
- **Length.** ≤ 200 lines.
- **MUST contain.** Value proposition (1 paragraph); a reference example of rendered output; install snippet (≤ 5 lines); link grid to the rest of the docs; CI status badges; requirements (host runtime version, platforms); contribute pointer; licence.
- **MUST NOT contain.** Detailed reference material; long-form rationale; tutorials.

---

## `docs/get-started`

- **Reader.** A user who has just decided to install.
- **Length.** ≤ 80 lines.
- **MUST contain.** A five-minute happy-path: prerequisites → install → first render → "now what" (link to widgets / themes / editor).

---

## `docs/install`

- **Reader.** A user who wants to install (or has trouble installing).
- **Length.** ≤ 200 lines.
- **MUST contain.** Preconditions, install path (registry / from-source), what `install` writes to disk and the host settings file, how to verify it worked, how to roll back (`uninstall` flow), per-platform notes (macOS / Linux / Windows-via-WSL or Git-Bash).
- **MUST NOT contain.** Architecture details; widget reference.

---

## `docs/config`

- **Reader.** A user customising their statusline by editing the config file directly.
- **Length.** ≤ 300 lines.
- **MUST contain.** Config file location (and how it's discovered); the layered merge order; every top-level key with type, default, and notes; the widget shape; the colour grammar; the env-var override convention; how to validate edits.
- **MUST NOT contain.** Widget-specific options (those live in `docs/widgets`).

---

## `docs/widgets`

- **Reader.** A user looking up "what does X widget render and what options does it take".
- **Length.** ≤ 400 lines.
- **MUST contain.** Every widget family; every widget's renders + required and optional `options`; reset-axis requirements where applicable; examples.
- **MUST NOT contain.** Implementation details of how a widget computes its value.

---

## `docs/themes`

- **Reader.** A user picking a theme or authoring one.
- **Length.** ≤ 200 lines.
- **MUST contain.** Theme schema; the four (or more) shipped presets with a screenshot or ANSI sample of each; how to author a custom theme (file location, schema validation, palette roles); colour-depth degradation behaviour.

---

## `docs/keymap`

- **Reader.** A user in the TUI editor wondering "what key does X".
- **Length.** ≤ 100 lines.
- **MUST contain.** Every binding in the default keymap, grouped by scope (`edit`, `picker`, `any`); how to override via `config.keymap`; gate 17 reference (this doc is the authoritative source).

---

## `docs/doctor`

- **Reader.** A user whose statusline isn't working and is running `doctor`.
- **Length.** ≤ 250 lines.
- **MUST contain.** Each check D01–D08 with cause, impact, and remedy (whether `--fix` will repair it); how to interpret a JSON doctor report.

---

## `docs/troubleshooting`

- **Reader.** A user whose problem is not on the doctor checklist.
- **Length.** ≤ 200 lines.
- **MUST contain.** Symptom → cause → fix runbook for the top dozen support tickets; an "unknown problem? open an issue" pointer.

---

## `docs/cli`

- **Reader.** A user or scriptwriter reaching for `<bin> <verb> --flag`.
- **Length.** ≤ 400 lines.
- **MUST contain.** Every verb with every flag, with descriptions and examples; exit codes; environment variables read.

---

## `docs/testing`

- **Reader.** A contributor running tests locally.
- **Length.** ≤ 200 lines.
- **MUST contain.** How to run unit tests, golden tests, gates, integration tests; how to add a new test or scenario; how to update a golden intentionally; pointer to `13-testing-strategy`.

---

## `docs/architecture`

- **Reader.** A contributor or curious operator wanting to understand the moving parts.
- **Length.** ≤ 200 lines.
- **MUST contain.** Render-path / cold-path split; render-pipeline stages; state surfaces; failure model; pointer to `04-architecture` in the cookbook.

---

## `docs/GLOSSARY`

- **Reader.** Anyone tripping over a term.
- **Length.** As needed; one short entry per term, kept tight.
- **MUST contain.** Canonical definitions for every domain term that appears in more than one doc; "distinct from" clarifiers when nearby terms collide.
- **Stance.** When a comment, doc, or identifier conflicts with the glossary, the glossary wins — update the other artefact.

---

## `docs/plan/SPEC-vX.Y.Z`

- **Reader.** A current-maintainer engineer authoring a PR.
- **Length.** As long as needed; the reference implementation runs about 750 lines.
- **MUST contain.** Normative, stack-locked requirements for the current version. Section numbers stable across revisions. Forbidden behaviours called out explicitly.

---

## `docs/plan/PR-PLAN`

- **Reader.** A maintainer planning the work for this version.
- **MUST contain.** Numbered PR roadmap mapping spec sections to PRs; dependencies; parallel-safe flags; critical path.

---

## `docs/plan/PR-CONVENTIONS`

- **Reader.** A maintainer opening a PR.
- **MUST contain.** Branch naming convention; commit format (Conventional Commits, scopes list); PR title shape; PR body template; merge rules; author maintenance expectations; forbidden actions (`--no-verify`, etc.).

---

## `CHANGELOG`

- **Reader.** A user or downstream packager reading release notes.
- **MUST contain.** Keep-a-Changelog format; one section per release, plus `[Unreleased]` accumulating between tags; entries grouped `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`; each entry has the short commit SHA and a one-line summary.

---

## `CONTRIBUTING`

- **Reader.** A first-time contributor.
- **MUST contain.** Dev bootstrap (install deps, build, run gates); branch and commit conventions; the "add a widget" recipe (≤ 5 steps); gate command; changelog-fragment workflow; how to open issues.

---

## `CODE_OF_CONDUCT`

- **MUST contain.** Contributor Covenant 2.1 verbatim (or a documented equivalent) with the project-specific contact email filled in.

---

## `SECURITY`

- **MUST contain.** Disclosure channel (private GitHub advisory or equivalent); SLA (acknowledge in 5 business days); supported versions; what counts as a security issue vs a bug report.

---

## `SUPPORT`

- **MUST contain.** Where users get help (issue tracker, discussions, community channel); what to include in a support request; expected response timeline.

---

## `CLAUDE` (optional)

- **Purpose.** A briefing for any host-agent session opened in this repo (the repo is a CLI, not a plugin, but contributors using the host inside the repo benefit from a one-page primer).
- **MUST contain.** What this repo is; spec location; house rules (clean-room, deps policy, no network at render); naming policy; non-goals; quick commands; source layout summary.

---

## Shipped skill files (`agents/<product>*.md`)

- **Reader.** A host coding-agent session that needs to operate the product on the user's behalf (install, configure, theme, troubleshoot).
- **Distribution.** Committed under `agents/` in the repo; copied into the host's agents directory by the installer (see `04 · State surfaces`, `16 · Skill-file lifecycle`).
- **Length.** ≤ 200 lines each.
- **MUST contain.** YAML frontmatter with a `description:` line the host will use as the dispatch contract — phrased so the host can route natural-language requests like "change my theme" to the right file. Body MUST contain a short cheatsheet (commands, file paths, decision rules) the agent can apply without further reading.
- **MUST NOT contain.** Absolute user-home paths (`/Users/*`, `/home/*`, `~/.claude/*` literals — gate 02 enforces), trademark strings outside the allowlist (gate 06), or retired glossary terms (gate 20).
- **Versioning.** Byte-coupled to the package version. See `16 · Skill-file lifecycle` for the upgrade contract.

---

## Documentation maintenance rules

- A doc file MUST have one owner (a directory CODEOWNERS line or equivalent).
- Renaming a doc requires a redirect note in the prior file for one release cycle.
- Removing a doc requires a changelog entry.
- Length envelopes are aspirational; exceeding by 20% is fine, by 100% is a smell — split the doc.
