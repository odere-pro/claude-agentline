# Security policy

`agentline` is the `@agentline/cli` statusline tool wired into Claude Code via the `statusLine` key of the Claude config. The render hot path makes no network calls, ships no native modules, and writes config atomically. This document defines what counts as a vulnerability, how to report one privately, and what is explicitly out of scope so future audits don't re-flag known design choices.

## Supported versions

| Version | Status                          |
| ------- | ------------------------------- |
| 0.1.x   | Supported — fixes ship as 0.1.z |
| < 0.1   | Unsupported — please upgrade    |

Once 0.2.0 ships, only the latest 0.x line receives security fixes.

## Reporting a vulnerability

Use GitHub's private security advisory flow. Do **not** open a public issue.

- Open a draft advisory: <https://github.com/odere-pro/claude-agentline/security/advisories/new>
- Include: affected version (`agentline --version`), host OS and Node version, a minimal reproducer, and your assessment of impact.
- Acknowledgement target: **72 hours**.
- Fix-or-mitigation target: **14 days** for confirmed in-scope reports. Coordinated disclosure window is negotiable for complex findings.

If you cannot use GitHub advisories, open an issue titled `security contact request` (no details) and a maintainer will reach out.

## Trust model

The trust model is documented end-to-end in `docs/plan/SPEC-v0.1.0.md`. Summary:

- **stdin is trusted.** Statusline stdin is supplied by Claude Code, which is the only intended sender; the render path enforces the 256 KiB cap (§8.1) and rejects malformed JSON, and it does not fetch anything based on the payload.
- **User config is trusted.** A user who edits their own `.agentline.json` or theme JSON can already run arbitrary code on their own machine; widget options that shell out (the `command` widget, §7.8.3) are accepted by design when sourced from the user layer.
- **Project config is partially trusted.** A `.agentline.json` checked into a repo (layer 3) cannot inject `command` widgets unless the user opts in via `AGENTLINE_TRUST_PROJECT_COMMAND_WIDGETS=1`. Project-layer `command` widgets are silently dropped before merge otherwise.
- **The render path makes no network calls.** Gate 14 (`tests/gates/gate-14-no-network-render.sh`) enforces this; any new import that opens a socket fails CI.
- **Config writes are atomic.** Persisted writes to the agentline user config and to Claude Code settings go through write-temp + `fsync` + `rename`. The install flow is idempotent and reverses cleanly.
- **No remote code at install.** `agentline install` only wires the local bin into Claude Code settings and copies skill files; it does not download or execute additional payloads.

## In scope

Reports we treat as security issues:

- Malformed stdin payload triggering remote code execution, prototype pollution, arbitrary file write, or path traversal inside the render path.
- Theme or config field that escalates privileges before any sandboxed `command` widget runs (e.g. a JSON value evaluated as code).
- Install or uninstall flow performing a symlink race, shell injection, or writing outside `${CLAUDE_CONFIG_DIR}` and the project tree.
- Render path that reaches the network for any reason, including telemetry, update checks, or third-party widget plugins.
- Reachable CVE in a pinned runtime dependency on a supported Node line.
- Cache or transcript reads exceeding their documented size caps, or escaping the configured root directory.

## Out of scope

Behaviours that are documented features, not flaws:

- The `command` widget executing user-supplied shell. It runs in a sandbox with a 250 ms default timeout (2 000 ms hard cap), a 1 KiB stdout cap, no inherited stdin, discarded stderr, and `windowsHide`. Misuse by the user who configured the command is not a vulnerability.
- A user-supplied `cwd`, `shell`, or environment allowlist on a `command` widget. The allowlist intentionally lets users pick their own shell; that is the feature.
- A user-edited config that points the theme loader at a path it cannot read. The loader fails closed and renders a degraded statusline; this is the intended degradation.
- A 256 KiB stdin payload taking longer to render than a 1 KiB one. The cap is the budget.
- Hand-edited Claude Code settings that no longer parse. Run `agentline doctor --fix` to restore a working block.
- A user opting into `AGENTLINE_TRUST_PROJECT_COMMAND_WIDGETS=1` and then running a malicious project. The env var is the opt-in gate; we will not adjudicate project-supplied commands once it is set.

## Disclosure

- On fix, the advisory is published with a CVE if one was minted and a CHANGELOG entry crediting the reporter (opt-out available).
- If the trust model changes as a result of the report, the spec section is updated in the same release and a short post-mortem lands under `docs/`.
- We will not silently patch in-scope reports; every advisory ships with a release that consumers can pin to.
