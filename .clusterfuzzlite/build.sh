#!/bin/bash -eu
# ClusterFuzzLite / OSS-Fuzz build script (language: javascript).
#
# Runs inside the base-builder-javascript image where $SRC, $OUT, and the
# `compile_javascript_fuzzer` helper are provided. It bundles the parsers
# into a single CommonJS module the Jazzer.js targets require, then compiles
# each target.

cd "$SRC/agentline"

# Install deps (corepack ships pnpm; package.json#packageManager pins it).
corepack enable
pnpm install --frozen-lockfile

# Bundle the fuzz entry (ESM TypeScript) into CommonJS so the Jazzer.js
# targets can `require("./bundle.cjs")`. esbuild ships with tsup (a dep).
pnpm exec esbuild .clusterfuzzlite/fuzz/entry.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile=.clusterfuzzlite/fuzz/bundle.cjs

# Compile each Jazzer.js fuzz target.
for target in fuzz_stdin_json fuzz_config_validate fuzz_transcript; do
  compile_javascript_fuzzer agentline ".clusterfuzzlite/fuzz/${target}.js" --sync
done
