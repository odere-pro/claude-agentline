<!-- sha: 2e41b52 -->

Wire up the gates orchestrator so every PR can prove its quality bar in one command: `tests/gates/run-all.sh` discovers gate scripts under `tests/gates/`, runs them with a strict 0/1/2 exit contract, and writes per-gate NDJSON results under `tests/gates/.tmp/` for CI artefact upload. First three gates land alongside (`gate-01-doctor` skips until skeleton lands, `gate-02-no-absolute-paths`, `gate-03-shellcheck`).
