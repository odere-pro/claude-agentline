# Support

`agentline` is community-supported. This page lists where to take each kind of question or report so it lands in front of the right person quickly.

## Bugs

Something misbehaves on a supported host (Node ≥ 20 LTS, macOS / Linux / WSL).

- File a GitHub issue with the [`bug` template](.github/ISSUE_TEMPLATE/bug.md).
- Include `agentline --version`, host OS, Node version, and the smallest reproducer you can produce.
- If the symptom is wiring-related, paste the relevant section of your Claude Code settings (with secrets redacted).

## Questions and discussion

How-to questions, configuration help, design discussion.

- Prefer GitHub Discussions if enabled on the repo.
- Otherwise open an issue using the [`feature` template](.github/ISSUE_TEMPLATE/feature.md) and prefix the title with `q:` so triage can route it.

## Gate failures

A repo gate (`tests/gates/gate-NN-*.sh`) fails locally or in CI and you cannot tell why from the gate output.

- File a GitHub issue with the [`gate-failure` template](.github/ISSUE_TEMPLATE/gate-failure.md).
- Paste the failing gate's output verbatim. The template prompts for the host details we need.

## Security reports

Suspected vulnerability — see [SECURITY.md](SECURITY.md). **Do not open a public issue** for security findings; use the private advisory flow described there.

## Self-service

Common problems are usually faster to diagnose than to file:

- Install or wiring issues: [`docs/install.md`](docs/install.md).
- Statusline not rendering, slow render, or empty output: [`docs/doctor.md`](docs/doctor.md) and `agentline doctor` / `agentline doctor --fix`.
- TUI editor key bindings: [`docs/keymap.md`](docs/keymap.md).
- Widget catalogue and option reference: [`docs/widgets.md`](docs/widgets.md).
- General configuration: [`docs/config.md`](docs/config.md).

## Response expectations

This is an open-source project maintained on best-effort. Security reports follow the SLA in `SECURITY.md` (72 h ack, 14 d fix-or-mitigation). Other reports are triaged when a maintainer is available — clear reproducers move first.
