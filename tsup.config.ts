import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
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
