# 06 · Data contracts

> **Intent:** Specify every JSON shape that crosses a system boundary, in stack-agnostic terms.
> **Reads-with:** `04-architecture`, `07-component-specs`, `17-security-and-compliance`.

Each contract: **name**, **purpose**, **version key**, **top-level keys**, **strictness**, **forbidden keys**, **migration rule**.

---

## Host stdin contract

**Purpose.** The host application's payload, delivered on stdin each render.

**Version key.** Not under our control; the host owns this shape. The implementer pins to the documented version and tolerates unknown fields (forward-compat).

**Top-level keys (typical).**

| Key               | Type   | Notes                                                                                                                                                                                                                                                                   |
| ----------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`           | string | Active model id                                                                                                                                                                                                                                                         |
| `sessionId`       | string | Stable per session                                                                                                                                                                                                                                                      |
| `sessionName`     | string | User-chosen label (may be empty)                                                                                                                                                                                                                                        |
| `version`         | string | Host version                                                                                                                                                                                                                                                            |
| `cwd`             | string | Working directory the host is running in                                                                                                                                                                                                                                |
| `transcript_path` | string | Path to JSONL transcript file (subject to sandbox)                                                                                                                                                                                                                      |
| `thinkingEffort`  | string | `low` / `medium` / `high` / `xhigh`                                                                                                                                                                                                                                     |
| `skills`          | array  | Skills loaded for this session                                                                                                                                                                                                                                          |
| `user.email`      | string | Optional; falls back to auth file                                                                                                                                                                                                                                       |
| `rate_limits`     | object | `{ five_hour, seven_day }`, each `{ used_percentage, resets_at }` — the host's `/usage` numbers. `used_percentage` feeds the usage widgets; `resets_at` (epoch seconds) feeds the reset-timer / reset-at widgets, which fall back to a local estimate when it is absent |
| Other host fields | …      | Preserved untouched.                                                                                                                                                                                                                                                    |

**Strictness.** Lenient — unknown fields are preserved. Truncated above 256 KB with a `truncated` marker emitted to stderr.

**Forbidden keys at parse boundary.** `__proto__`, `constructor`, `prototype` — stripped recursively (see `05-design-patterns · Reserved-meta-key strip`).

---

## User config

**Purpose.** Persisted statusline configuration. Single global location.

**Version key.** `version` (int). The binary auto-migrates older versions; newer versions are refused with a structured error.

**Location.** `${HOST_CONFIG_DIR:-~/.config}/<product>/config.json`. There is no per-project layer.

**Top-level keys.**

| Key               | Type   | Default     | Notes                                                                                                    |
| ----------------- | ------ | ----------- | -------------------------------------------------------------------------------------------------------- |
| `$schema`         | string | URL         | Schema URL for editor tooling                                                                            |
| `version`         | int    | `1`         | Schema version                                                                                           |
| `theme`           | string | `null`      | Named theme from the theme registry                                                                      |
| `lines`           | array  | one default | Ordered list of `{ widgets: Widget[] }`                                                                  |
| `global`          | object | defaults    | Render options: `padding`, `separator`, `inheritColors`, etc.                                            |
| `powerline`       | object | defaults    | Powerline options (see `02-functional-requirements · F5`)                                                |
| `terminalWidth`   | object | defaults    | Width-detection mode: `full`, `full-minus-N`, `full-until-compact`                                       |
| `keymap`          | object | `{}`        | Editor keymap overrides                                                                                  |
| `refreshInterval` | int    | `5`         | Statusline re-run period in seconds; `>= 0`. `0` disables, syncing the host so it re-runs on events only |

**Strictness.** Root object: `additionalProperties: false`. `widgets[].options` and `palette` are extensible (`additionalProperties: true`); the reserved-key strip applies there to close the prototype-pollution gap.

**Migration rule.** A newer binary reading an older `version` auto-migrates and writes a backup `<config>.bak`. The migration is documented in the changelog under the binary's release notes.

---

## Widget shape

**Purpose.** Each entry in `lines[].widgets[]`.

| Key        | Type   | Required | Notes                                          |
| ---------- | ------ | -------- | ---------------------------------------------- |
| `type`     | string | yes      | Registered widget id                           |
| `id`       | string | no       | Arbitrary; useful for keymap targeting         |
| `fg`       | colour | no       | Named, indexed, or hex                         |
| `bg`       | colour | no       | Same                                           |
| `bold`     | bool   | no       |                                                |
| `italic`   | bool   | no       |                                                |
| `rawValue` | bool   | no       | Suppress built-in label                        |
| `merged`   | enum   | no       | `off` / `merge` / `merge-no-padding`           |
| `hidden`   | bool   | no       | Render as empty                                |
| `options`  | object | no       | Widget-specific. `additionalProperties: true`. |

**Colour values:**

- Named: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, plus `bright-*` variants.
- 256-colour index: `"colour:NNN"` where `0 ≤ NNN ≤ 255`.
- 24-bit hex: `"#RRGGBB"`.

Anything else is a schema error.

---

## Theme

**Purpose.** Named palette mapping role → colour.

```text
{
  "$schema":   URL,
  "name":      string,           // kebab-case
  "palette":   { role: colour, … },
  "powerline": { glyph keys: string, … }
}
```

**Roles** consumed by built-in widgets: `accent`, `info`, `success`, `warning`, `danger`, `muted`, `git-clean`, `git-dirty`, `tokens-low`, `tokens-mid`, `tokens-high`, `bg-section`, `bg-emphasis`. Themes MUST define every role; missing roles fall back to compiled defaults.

**Strictness.** Root: `additionalProperties: false`. `palette` is extensible.

---

## Fixture (for golden tests)

**Purpose.** Reproduce a render byte-exactly for regression testing.

A scenario directory contains:

| File            | Contents                                            |
| --------------- | --------------------------------------------------- |
| `stdin.json`    | Recorded host stdin payload                         |
| `config.json`   | Active config                                       |
| `clock.txt`     | Frozen wall-clock value (ISO 8601 UTC)              |
| `expected.ansi` | Byte-exact expected stdout (including ANSI escapes) |

`<bin> render --fixture <scenario-dir>` reproduces the line. The gate iterates every scenario.

---

## Auth file (fallback for session widgets)

**Purpose.** Read-only fallback when the host stdin payload omits identity fields (`accountEmail`, `loginMethod`, `orgSlug`).

**Sources, in precedence order.**

1. **Legacy auth file** — `${HOST_CONFIG_DIR}/auth.json`. Flat object with `email` / `authMethod` / `orgSlug` string keys. Size cap: 64 KB. Wins per-field when present (back-compat).
2. **Host primary config `oauthAccount`** — the host's main config file (`${HOST_CONFIG_DIR}/.claude.json` when `CLAUDE_CONFIG_DIR` is set, else `~/.claude.json`; note this is a _sibling_ of the config dir, not inside it). Modern hosts no longer ship a plaintext auth file, so this is the only source on current installs. The `oauthAccount` block supplies `emailAddress` → email, `organizationName` → org, and an implied `oauth` login method. Size cap: 4 MB (this file grows with per-project history).

**Read mode.** Read-only, single bounded synchronous read per render tick, never throws. Missing / oversize / malformed / symlink-to-special-device inputs are treated as unreadable and the dependent widget renders as hidden. Only a handful of scalar identity fields are extracted; the rest of the (potentially large) file is ignored.

**Sandboxing.** Paths resolve from `CLAUDE_CONFIG_DIR` / the home directory only — no caller-supplied path is followed.

---

## Transcript file (token widgets)

**Purpose.** JSONL ledger of host API calls — each line is one event (request metadata, token counts, session boundary, model switch, block reset).

**Location.** Whatever the host's `transcript_path` field on stdin points to.

**Read mode.** Read-only, cached by `(path, mtime, size)`. Per-file cap: 16 MB. Oversize files render dependent widgets as hidden.

**Sandboxing.** MUST resolve under the host's config root. The env var `<PRODUCT>_TRANSCRIPT_ROOT` overrides for tests.

---

## Backup metadata (install / uninstall)

**Purpose.** Capture the prior host-state value so `uninstall` can restore byte-for-byte.

```text
{
  "version":   int,
  "wrote_at":  ISO 8601 UTC,
  "host":      string,             // host application id
  "prior":     <prior value>,      // original `statusLine` value, or null if unset
  "checksum":  "sha256:<hex>"      // over the prior value's canonical JSON encoding
}
```

**Location.** `${HOST_CONFIG_DIR}/<product>/backup.json`.

**Lifecycle.** Written by `install` (first time only — refuses to overwrite without `--force`). Consumed by `uninstall` (which verifies the checksum before restoring).

---

## Universal forbidden keys

At **every JSON parse boundary** in this product (user config, env-var-encoded JSON, theme files, fixture stdin), drop own keys named:

- `__proto__`
- `constructor`
- `prototype`

Apply recursively. This is the single primitive against prototype-pollution-style attacks in runtimes where these keys are meta-keys; it is also harmless in runtimes where they aren't. The strict-schema root catches them at the top level; this recursive strip catches them inside `additionalProperties: true` carve-outs.
