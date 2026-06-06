- Add shipped config templates and a command to seed from them:
  - New `minimal` (lean single-line) and `power` (rich four-line) config templates alongside the existing `default`. All three are validated against the schema by gate-11, which now round-trips every `templates/*.config.json`.
  - New **`agentline config init [--preset <name>] [--force]`** seeds the user config from a config template (default: `default`). It refuses to overwrite an existing config without `--force` (mirroring `reset`), validates before writing, and writes atomically. An unknown name errors and lists the available templates.
- `agentline config widget catalog` now surfaces each widget's **variants** (text and `--json`), so the available display styles are discoverable without reading source.

Note: comprehensive add-time widget-option validation is deferred — it needs a per-widget option schema (a separate change).
