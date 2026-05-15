# 01 · Vision and goals

> **Intent:** Anchor every later decision against a durable single-sentence vision, observable success criteria, and an explicit non-goals list.
> **Reads-with:** `00-overview`, `10-tradeoffs-and-decisions`, `03-non-functional-requirements`.

## Vision

> A fast, themeable, offline statusline renderer for a host coding agent — stack-independent, reversible to install, and trivial to extend through configuration alone.

## Success criteria (observable)

| #   | Criterion                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | Cold-start budget met on the reference host with a five-widget single-line config.                                                                                      |
| V2  | Steady-state render budget met under the same config.                                                                                                                   |
| V3  | Same stdin payload + same config + frozen clock ⇒ byte-identical stdout.                                                                                                |
| V4  | Render path makes zero network calls and zero writes to disk, environment, or host settings.                                                                            |
| V5  | `install` followed immediately by `uninstall` leaves the host filesystem identical to its pre-install state.                                                            |
| V6  | All host-state mutations are reversible from a backup file the install wrote.                                                                                           |
| V7  | A user can fully change the layout and theme without restarting the host application.                                                                                   |
| V8  | A user can perform every customization through (a) the editor UI, (b) the scriptable config CLI, or (c) by handing the host agent a natural-language instruction.       |
| V9  | The renderer never emits a blank line; on unrecoverable error it writes one ASCII fallback line and exits non-zero.                                                     |
| V10 | The schema is forward-compatible: an older binary refuses a newer schema with a structured error; a newer binary auto-migrates and writes a backup of the older config. |

Anything not on this list is not part of the v0.1.0 contract.

## Non-goals (deferred or refused)

- **Plugin distribution.** Not a plugin of the host. No manifest, no slash commands, no hook bindings.
- **Telemetry.** Of any kind. Including anonymous usage stats.
- **Remote update checks** on the render path. An explicit `update-check` verb may exist; it does not run implicitly.
- **Native binaries.** The runtime is single-language at v0.1. Native distribution is a v0.3+ topic.
- **Package-manager taps** (Homebrew, etc.) at v0.1; primary channel is the language's package registry.
- **`curl … | sh` installer.** Refused for supply-chain hygiene.
- **Dynamic widget plugins** (loadable libraries, WASM, scripted widgets). Widget set is fixed at build time. There is a sandboxed `command` widget escape hatch for one-shot shell output.
- **Per-tenant pricing tables.** Cost widgets use one embedded table refreshed at release time.
- **Powershell-native install scripts** at v0.1. Windows hosts use Git Bash or WSL.
- **Per-project config overrides** at v0.1. There is exactly one config layer between defaults and env vars. A `.<product>.json` in the cwd is ignored by design.

## Clean-room rule

Identifiers, prose, and code patterns MUST NOT be derived from any prior implementation of a similar tool, including ones the implementer has personally written. The cookbook itself is the only authoritative source.

Two reasons:

1. **Trademark and licence safety.** A new implementation that materially resembles a prior one inherits its legal exposure.
2. **Naming clarity.** The product name MUST clear three checks at freeze date: no overlap with the host application's brand, no published package of the same name on the target language's primary registry, no kebab-case collision with widely-known CLIs.

## Naming policy

- Kebab-clean lowercase identifier, 6–12 characters.
- No reuse of the host application's brand in the bin name.
- License declared in `LICENSE` and `package.json` (or the language equivalent); SPDX identifier must match in both.

## How to know you have shipped v0.1.0

All ten Vn criteria above are continuously verified by the gate suite (`14-gates-catalogue`). When the gates are green on `main`, you can tag v0.1.0.
