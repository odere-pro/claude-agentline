import { defineConfig } from "tsup";

export default defineConfig({
  // Two entries:
  //   - `cli`  — always-loaded statusline binary; render hot path.
  //   - `tui`  — Ink editor entry. Only loaded when
  //              `agentline config` runs a dynamic
  //              `import("./tui.mjs")` from cli.mjs (§1.2 N3).
  //              A separate output file keeps Ink + React out of
  //              cli.mjs's parse path.
  entry: { cli: "src/cli.ts", tui: "src/tui/main.ts" },
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
