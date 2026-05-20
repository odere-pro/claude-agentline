# 10 · Tradeoffs and decisions

> **Intent:** Record the non-obvious decisions, what was given up, what was gained, and the alternatives considered. New decisions append here; existing entries are amended in place rather than replaced.
> **Reads-with:** `01-vision-and-goals`, `04-architecture`, `09-tech-stack-choices`.

Each entry: **decision**, **alternatives**, **why this**, **what we give up**.

---

## D-001 · CLI-only, not a host plugin

- **Alternatives.** Ship as a plugin of the host application (slash commands, hooks, manifest).
- **Why this.** Stack independence. The plugin path locks the implementation to whatever runtime the host expects from plugins, and forces a non-trivial dependency on a still-evolving plugin contract. The CLI path uses the host's stable statusline contract (`statusLine` + stdin JSON) and otherwise stays at arm's length.
- **What we give up.** First-class slash-command surface from inside the host; first-class plugin distribution; auto-discovery by users of the host's plugin index.

---

## D-002 · Clean-room rule

- **Alternatives.** Adopt code, patterns, or naming from prior implementations of similar tools.
- **Why this.** Licence and trademark safety; no inherited legal exposure. Naming clarity (no overlap with host brand, no kebab-case collision with known CLIs, no published package of the same name on the target registry at freeze date).
- **What we give up.** Code reuse; familiarity to users of prior tools.

---

## D-003 · Pure-JS runtime path (in the reference implementation; abstractly, "managed-runtime-only")

- **Alternatives.** Bundle native modules for performance-sensitive paths (regex engines, ANSI encoders).
- **Why this.** Zero-build install on any host: the user runs `<registry> install -g <product>` and it works. No compiler tooling required on the user's machine.
- **What we give up.** Some perf on pathological inputs.

---

## D-004 · Layered config without a per-project layer

- **Alternatives.** Allow `.<product>.json` in the cwd to override global config (the "git-config style").
- **Why this.** A single source of truth. The user's statusline is a personal preference, not a per-repo one. Per-project overrides multiplied debugging surface and made "reset to defaults" a non-trivial operation.
- **What we give up.** Per-repo theming and widget arrangements. Power users who really want this can manage multiple config files outside the product and pass `--config` explicitly.

---

## D-005 · Hot path / cold path split

- **Alternatives.** Share code between the render path and the editor freely (DRY).
- **Why this.** The cold-start budget is dominated by the import graph. A single accidental top-level import of the TUI framework can blow the budget by 5×. The split is the only durable enforcement.
- **What we give up.** Code sharing convenience between widgets and editor preview. Specifically, the editor cannot import widget render functions directly without bringing the render-path module graph into the editor; either the widgets are written to be safely importable from both paths (the chosen approach), or the editor maintains its own preview adapter.

---

## D-006 · Frozen-clock determinism for tests

- **Alternatives.** Mock wall-clock at the call site; or skip time-sensitive widgets in goldens.
- **Why this.** A single context-level clock handle, frozen at scenario setup, makes every widget testable identically. Goldens stay byte-stable across time zones, daylight-saving boundaries, and CI runners.
- **What we give up.** Live wall-clock in tests (would have been useful for one or two stress tests; the cost is small).

---

## D-007 · Schema-versioned config with auto-migration

- **Alternatives.** Always-compatible schema (no version field); or hard breaks on every schema change.
- **Why this.** Forward compat: older binaries refuse newer schemas with a structured error rather than rendering garbage. Backward compat: a newer binary migrates an older config and writes a `.bak` so the user can revert.
- **What we give up.** The temptation of immediate breaking changes. Every schema migration must be coded once and lives forever in the migration pipeline.

---

## D-008 · Reversible install with byte-checksummed backup

- **Alternatives.** Install writes the settings directly; uninstall removes it.
- **Why this.** Trust. Users adopt a tool that touches their `~/.claude/settings.json` only if they can fully undo the change. The byte-level backup with a checksum lets `uninstall` verify it is restoring the original value, not corrupting something the user changed in the interim.
- **What we give up.** Some install/uninstall complexity. Worth it — the abstraction is small and the user-facing trust gain is large.

---

## D-009 · Sandboxed file reads under the host config root

- **Alternatives.** Trust `transcript_path` and `auth file path` from the host stdin payload at face value.
- **Why this.** A malformed stdin payload setting `transcript_path: "/etc/shadow"` MUST NOT become an arbitrary-file-read primitive. Token counts in the rendered line are observable; an attacker could probe the existence and parse failures of files under different paths.
- **What we give up.** Some flexibility in placing the transcript file outside the host's config root. Tests get an env-var escape (`<PRODUCT>_TRANSCRIPT_ROOT`).

---

## D-010 · Reserved-meta-key strip at every JSON parse boundary

- **Alternatives.** Rely on the strict-root schema to catch reserved keys at the top.
- **Why this.** Strict-root catches them at level 0; the recursive strip catches them inside `palette` and `widget.options` where the schema is intentionally lenient (`additionalProperties: true`). Cheap insurance.
- **What we give up.** Cycles per parse. Trivial.

---

## D-011 · Flat CLI surface (no nested dispatchers)

- **Alternatives.** Nested verbs: `<bin> config widget add`, `<bin> theme list`, etc.
- **Why this.** Cold-start path is shorter — the parser knows what verb it is from the first arg. Discoverability via `<bin> --help` shows everything in one view.
- **What we give up.** Some ergonomics for command groups. Mitigated by giving each "verb group" a short prefix (`config widget add` becomes `config-widget-add` if you like; `config schema` stays as `config-schema`). The reference implementation chose mixed: `<bin> config widget <op>` is one verb under-the-hood.

---

## D-012 · _Reversed_ — pricing/cost feature dropped

- **Original decision.** Ship an embedded pricing table refreshed at release time so cost/spend widgets could render without network at render time.
- **Reversal.** The pricing/cost feature was removed wholesale: the embedded pricing table, the cost/spend widgets, and the `gate-22` pricing-freshness gate plus its CI workflow are all gone. Token widgets now cover counts and speed only. Per the stable-ID rule, the decision number is retained and not reused.

---

## D-013 · Single binary; widget set fixed at build time

- **Alternatives.** Dynamic widget plugins via shared libraries or WASM.
- **Why this.** Cold-start budget; security (no arbitrary code loaded at render time); simplicity (no plugin ABI to maintain). The `command` widget is the deliberate escape hatch for one-shot user code, with timeouts and argv-style invocation.
- **What we give up.** Third-party widget distribution. Deferred to v0.3+.

---

## D-014 · One config layer change per PR; changelog fragment required

- **Alternatives.** Implicit changelog management; aggregate at release.
- **Why this.** Every behaviour change leaves a paper trail that ships with the release notes. Conflicts on changelog fragments are rare-to-impossible by design (one fragment file per PR).
- **What we give up.** Two-line overhead per PR (the fragment file).

---

## How to add a new decision

Append a new entry below the highest existing ID. Never reuse IDs. Include alternatives, why-this, and what-we-give-up. If a decision is reversed, do not delete the entry — append a new entry that supersedes it and link back: `**Supersedes:** D-NNN`.
