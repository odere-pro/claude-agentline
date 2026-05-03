---
name: Gate failure
about: A §11.2 gate failed in CI or locally.
title: "gate: GATE-ID failing on SURFACE"
labels: ["gate-failure", "triage"]
---

## Gate

| Field | Value |
| --- | --- |
| Gate ID | `gate-NN-topic` |
| Spec § | §N.M |
| Where it failed | CI run URL / `bash tests/gates/run-all.sh` locally |
| Host | `macos-14` / `ubuntu-24.04` / `windows-2022` / ... |
| Node | `20` / `22` |
| Workflow run | (paste run URL, e.g. `actions/runs/RUN_ID`) |

## Failure output

Paste the gate's tail output (or attach the `tests/gates/.tmp/GATE-ID.log`
artefact uploaded by the workflow).

```text

```

## Suspected cause

What changed recently? Cite the suspect PR / commit if known.

## Reproduction

```bash
bash tests/gates/GATE-ID.sh
```

## Triage

- [ ] Reproduces on `main`
- [ ] Reproduces only on a specific OS / Node combination
- [ ] Flaky (passes on rerun)
- [ ] Spec ambiguity (gate contract needs revision)
- [ ] Implementation bug
