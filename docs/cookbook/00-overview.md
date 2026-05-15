# 00 · Overview

> **Intent:** State what the product is, in one page, with zero implementation detail.
> **Reads-with:** `01-vision-and-goals`, `04-architecture`.

## Elevator pitch

The host application — a coding agent CLI — exposes a one-line prompt area and offers a contract: any program named in the host's `statusLine` setting will be invoked once per prompt refresh, given a JSON payload on stdin, and expected to write a styled line to stdout. This cookbook builds a renderer for that surface: fast, themeable, deterministic, and offline.

## Reference output

A single ANSI-stripped line typically looks like:

```text
Opus 4.7 · main ●3 ↑1 · 23k tokens · $0.70 · 4h 12m left
```

Coloured variants, multi-line layouts, and Powerline-style chevrons are all configurable. The renderer never decides "what is interesting"; it composes widgets the user has put in their config in the order they sit there.

## Distribution model

This product is a **standalone CLI**. It is **not** a plugin of the host application. It does not ship slash commands, hooks, agent files, or any host-plugin scaffold. Wiring into the host happens once at install time by writing the binary's invocation into the host's `statusLine` settings key; uninstall reverses that exact byte change.

The decision to be CLI-only is load-bearing. It buys:

- stack independence (any language can implement it),
- cold-start headroom (no plugin framework overhead),
- a sharp privacy story (no plugin-side telemetry hooks).

It costs:

- no first-class slash-command surface,
- consumers wanting plugin-style integration must layer it themselves.

## Host contract surface

In one sentence: **the process reads JSON on stdin, writes one or more styled lines to stdout, and exits.**

Everything else — configuration, theming, widget arrangement, editor UI, doctor diagnostics — is internal scaffolding around that one contract.

## What you will end up shipping

| Artefact                  | Purpose                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| One executable            | The render binary. Also dispatches `install`, `uninstall`, `doctor`, `edit`, `config`, `start`, etc. |
| One config JSON Schema    | Source of truth for the on-disk config shape. Validates on load. Exported by a CLI verb.             |
| One theme JSON Schema     | Source of truth for theme files.                                                                     |
| A small theme set         | Built-in palettes (typically 4: light/dark × neutral/branded).                                       |
| A default config template | Copied into place by `install` if no user config exists.                                             |
| Lifecycle scripts         | `install` / `doctor` / `uninstall` wrapping the binary.                                              |
| Docs                      | See `15-documentation-set`.                                                                          |

## What you will not ship

- Telemetry of any kind.
- A networked render path. Updates and version checks are explicitly gated to their own verbs.
- Native binaries (defer until v0.3+; v0.1 is the runtime-managed single binary).
- A plugin manifest for the host application.
- A dynamic widget plugin system. Widget set is fixed at build time.
