---
name: Bug report
about: Something in agentline misbehaves on a supported host.
title: "bug: <short summary>"
labels: ["bug", "triage"]
---

## What happened

A clear, single-paragraph description of the misbehaviour.

## Reproduction

1. ...
2. ...
3. ...

```text
# Stdin payload, config, or command transcript that reproduces it.
```

## Expected

What you expected to see instead.

## Environment

| Field | Value |
| --- | --- |
| `agentline --version` | |
| OS | macOS 14 / Ubuntu 24.04 / Windows 11 (Git Bash) / ... |
| Node | `node --version` |
| Install method | `npm i -g` / `npx -y` / `--from-source` |
| Terminal | iTerm2 / Alacritty / Windows Terminal / ... |
| `$CLAUDE_CONFIG_DIR` set? | yes/no |

## Logs / screenshots

If a gate failed, attach the matching `tests/gates/.tmp/*.log`. If the
binary misrendered, attach the stdout bytes (e.g., `od -c`).

## Severity

- [ ] Blocks the render path
- [ ] Cosmetic / wrong colour / wrong glyph
- [ ] Affects a lifecycle script
- [ ] Other (explain)
