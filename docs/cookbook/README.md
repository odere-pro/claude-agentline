# Cookbook — recreate a Claude-Code statusline CLI from scratch

> **Intent:** Give a competent engineer everything they need to rebuild this software in any language, on any reasonable runtime, without reading the existing source.
> **Reads-with:** the entire `cookbook/` set.

## Who this is for

You want to build a small, fast, themeable CLI that:

- reads a JSON payload from stdin (the host's statusline contract),
- renders one or more ANSI-styled lines,
- writes them to stdout,
- exits.

You may be doing this in Go, Rust, Python, TypeScript, OCaml — whatever fits. The cookbook never tells you which library to use; it tells you what each piece must do.

## Audience assumptions

You are comfortable with:

- structured CLIs that read stdin and emit stdout,
- JSON Schema as a contract language,
- the difference between a render hot path and a configuration UI cold path,
- TUI rendering and terminal capability detection,
- supply-chain hygiene (signed releases, pinned deps),
- writing tests that assert byte-exact output.

You do **not** need prior knowledge of the reference implementation. If you find yourself opening that codebase to answer a question, the cookbook chapter that should have answered it is incomplete — please flag the gap.

## Reading order

| Mode         | Path                                                                                  |
| ------------ | ------------------------------------------------------------------------------------- |
| Impatient    | `00-overview` → `04-architecture` → `07-component-specs` → `12-assembly-instructions` |
| Thorough     | sequential `00 → 18`                                                                  |
| Architecture | `04 → 05 → 07 → 11`                                                                   |
| Contracts    | `06 → 14 → 17`                                                                        |
| Quality      | `03 → 13 → 14 → 16`                                                                   |

## Conventions

- Every chapter starts with **Intent:** and **Reads-with:** lines.
- Chapters are self-contained but cross-link liberally with `[[name]]`-style references.
- Numeric IDs (F1–F15, D01–D09, gates 01–24) are **stable**: when an ID is retired, the number is **not** reused. _Pre-1.0 history:_ the pricing/cost feature was dropped wholesale — the embedded pricing table, the cost/spend widgets, and the `gate-22` pricing-freshness gate (plus its CI workflow) are all gone; `gate-22` is a retired slot and token widgets now cover counts and speed only. There was no external contract on these IDs before 1.0; the no-reuse rule applies from here forward.
- "MUST", "SHOULD", "MAY" follow RFC 2119.
- Concrete tool names appear only in `09-tech-stack-choices.md`. Everywhere else, refer to roles ("schema validator", "TUI framework").

## Relation to the reference implementation's spec

The reference repo carries a normative, stack-locked spec at `docs/plan/SPEC-v0.1.0.md` (TypeScript, Node ≥20, Ink). This cookbook is the **abstract parent** of that spec. Section numbers are kept compatible (F1–F15, §-numbering) so existing spec citations still resolve when you rebuild in a different stack.

## What this cookbook deliberately does not contain

- A recommended language, runtime, or library stack.
- Tutorials. The cookbook is a specification, not a walkthrough.
- Performance tuning advice specific to any one runtime.
- Marketing copy.

## Out of scope

See `01-vision-and-goals.md` § "Non-goals".
