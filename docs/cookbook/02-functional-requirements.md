# 02 · Functional requirements

> **Intent:** Enumerate every user-visible capability the product MUST provide, in stack-agnostic language. Numbering is stable across cookbook revisions.
> **Reads-with:** `07-component-specs`, `08-feature-catalogue`.

Requirement IDs (Fn) are load-bearing — once assigned, never reused. F13 is retired in this revision (see note below).

---

## F1 — Render contract

A single bin reads JSON from stdin (the host statusline contract), reads the merged configuration (`F2`), renders one or more lines of styled text, and writes them to stdout.

- Exit code `0` on success, `1` on unrecoverable error.
- Non-zero exit MUST still produce a one-line ASCII fallback on stdout so the host UI is never blank.

## F2 — Layered configuration

Configuration is JSON, schema-versioned, and merged top-to-bottom (later overrides earlier):

1. Built-in defaults compiled into the bin.
2. The user config file (single global location; see `06-data-contracts`).
3. Environment variables with the product's prefix (e.g. `PRODUCT_KEY_PATH=value`, dot-path decoded).
4. Command-line flags.

There is **no per-project config layer**. A `.<product>.json` in the cwd is silently ignored by the loader.

## F3 — Lines are ordered widget lists

A line is an ordered list of widgets. A widget is one of: built-in (see `08-feature-catalogue`) or `separator`. Each line MUST contain at least one widget. Lines render top-to-bottom in declaration order.

## F4 — Per-widget style flags

A widget MAY specify foreground colour, background colour, bold, italic, raw-value mode (no built-in label), merge mode (controls inter-widget padding), and a hidden flag. Unset style flags inherit from theme role defaults, then from compiled defaults.

## F5 — Powerline mode

A global flag replaces inter-widget separators with chevron glyphs and computes adjoining colours so each chevron's foreground equals the previous widget's background and vice versa. Without a Nerd Font installed, the bin falls back to ASCII chevrons (`>`, `<`) and the doctor emits a warning.

## F6 — Horizontal flex layout

Content is left-aligned by default. The renderer supports a flex-true cell that expands to fill remaining horizontal width; multiple flex cells split the remainder equally.

## F7 — Reset axes

Token, cost, speed, and rate-limit accumulator widgets each declare a `reset` axis: `session`, `block`, `day`, `week`, `model`, or `effort` (see `06-data-contracts` for axis definitions). Mixed-axis aggregation is forbidden and is rejected as a schema error at config load.

## F8 — Git widgets are cwd-scoped

Git widgets read the working tree implied by the host's stdin `cwd` field. They MUST NOT shell out to anything but `git`. They MUST tolerate non-git directories by rendering as hidden.

## F9 — Session widgets with auth fallback

Session widgets read every field the host stdin contract exposes. When a field is absent, they MAY fall back to a read-only auth file under the host's config directory (size-capped; see `17-security-and-compliance`). Failure to read renders the widget as hidden — never errors.

## F10 — Interactive editor

A TUI editor verb lets users add, reorder, recolour, and toggle widgets with live preview. Persistence is atomic (write-temp + fsync-equivalent + rename). The editor and its framework MUST NOT be loaded by the render path.

## F11 — Doctor diagnostics

A `doctor` verb inspects host prerequisites, the wired settings entry, the merged config, and font availability. A `--fix` flag repairs a documented subset of misconfigurations; other findings are reported only.

## F12 — Dry-run from fixture

A `render --fixture <path>` verb reproduces a line from a recorded stdin fixture. Output is byte-identical to a real render under the same config and frozen clock.

## F13 — _(retired)_

Earlier drafts exposed a CLI surface for enumerating keymap bindings. The TUI footer carries that information; no separate CLI verb is needed.

## F14 — Schema export

A `config schema [--write <dir>]` verb prints (or writes to disk) the JSON Schema for the configuration so editors can pick it up. The schema's `$id` is a stable URL under the project's homepage.

## F15 — Live config reload

A render loop or watcher MAY watch all files in the merged config set; changes apply within one render tick without dropping in-flight stdin reads. Implementations that prefer one-shot render-and-exit can satisfy F15 by being fast enough that the host re-invokes the bin on every refresh.

---

## CLI surface (flat)

The CLI surface is intentionally flat. The default no-arg path is the render-on-stdin contract; every other verb is top-level. See `08-feature-catalogue` for the full verb list.

## Compatibility envelope

- Targets the host application's statusline JSON contract (see `06-data-contracts`).
- Tolerates unknown stdin fields (forward-compatible).
- Bash 3.2+ for shell scripts on POSIX hosts; Powershell support deferred.
- Windows hosts run scripts under Git Bash or WSL.
