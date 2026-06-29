# `tests/fixtures/`

Captured inputs that back deterministic checks (distinct from the golden
render scenarios under `tests/golden/`, which pin rendered output).

## `host-payload-<version>.json`

A representative Claude Code statusline stdin payload, named for the host
`version` it reflects. `gate-29` (`scripts/check-host-contract.mjs`) wraps it
in a recording Proxy, runs every module that reads a top-level key off `raw`,
and asserts:

- every top-level key the host sends is either consumed by a reader or on the
  explicit ignore allowlist (so a newly-sent field fails CI instead of being
  silently dropped — the class of bug behind the `vim-mode` silent death), and
- the `Raw key` column of `docs/cookbook/06-data-contracts.md` matches the set
  of consumed host fields (no phantom rows, no missing rows).

The file is a test fixture, not a shipped artefact (`shipped_artefact_paths` in
`tests/gates/lib/common.sh` excludes `tests/fixtures/`), so the absolute-looking
`cwd` / `transcript_path` / `workspace` values it contains do not trip gate-02.

The active fixture is `host-payload-2.1.195.json` (it carries the observed-but-
undocumented `fast_mode` key, which `scripts/check-host-contract.mjs` lists in
`IGNORED`). The earlier `host-payload-2.1.193.json` is retained beside it as the
prior-version capture — provenance for the gate-29 introduction — and is not
read by the live gate.

### Refreshing for a new host version

When Claude Code ships a statusline contract change, capture a fresh payload —
the cached one at `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/state/last-stdin.json`
holds the verbatim host JSON under `payload.raw`. Add it as
`host-payload-<new-version>.json`, point `scripts/check-host-contract.mjs` at it
(or keep both and check the newest), and reconcile the adapter, the ignore
allowlist, and the data-contract table until `gate-29` is green again.
