import { defineConfig } from "tsup";

export default defineConfig({
  // Three entries:
  //   - `cli`  — always-loaded statusline binary; render hot path.
  //   - `tui`  — Ink editor entry. Only loaded when
  //              `agentline edit` runs a dynamic
  //              `import("./tui.mjs")` from cli.mjs (§1.2 N3).
  //              A separate output file keeps Ink + React out of
  //              cli.mjs's parse path.
  //   - `keys` — keymap registry; consumed by gate-17 (keymap
  //              coverage) so the gate can verify §5.5 actions
  //              without depending on a CLI surface.
  entry: { cli: "src/cli.ts", tui: "src/tui/main.ts", keys: "src/keys/index.ts" },
  outDir: "dist",
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  target: "node20",
  platform: "node",
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  minify: false,
  shims: false,
  treeshake: true,
  banner: { js: "#!/usr/bin/env node" },
});
