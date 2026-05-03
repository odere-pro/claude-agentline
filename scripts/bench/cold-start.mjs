#!/usr/bin/env node
/**
 * scripts/bench/cold-start.mjs
 *
 * Cold-start performance harness for the §1.2 N2 budget:
 *   ≤120 ms wall-clock p95 from `node` process start to first byte on
 *   stdout, for a 5-widget single-line config, with a warm package cache.
 *
 * Usage:
 *   node scripts/bench/cold-start.mjs               # default 30 samples,
 *                                                   # 3 warm-up runs
 *   node scripts/bench/cold-start.mjs --samples 60  # override sample count
 *   node scripts/bench/cold-start.mjs --json        # machine-readable
 *                                                   # NDJSON-ish summary
 *
 * Exit codes:
 *   0 — bench ran cleanly. The caller (gate-13) is responsible for
 *       comparing the printed p95 against the configured budget.
 *   1 — bench failed to run (missing bin, child crash, etc.).
 *
 * Notes:
 *   - Each sample spawns a fresh `node` process so we measure the real
 *     cold start: parse, instantiate, dispatch, write.
 *   - Timing is process-spawn → first stdout `data` event, captured via
 *     `process.hrtime.bigint()`. Closing the stdin pipe early lets the
 *     bin exit promptly.
 *   - Warm-up runs absorb filesystem-cache and v8 bytecode-cache effects
 *     so p50/p95 reflect steady cold-start, not first-ever boot.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const DEFAULT_BIN = resolve(REPO_ROOT, "dist", "cli.mjs");
const DEFAULT_SAMPLES = 30;
const DEFAULT_WARMUP = 3;

const PAYLOAD = JSON.stringify({
  model: "sonnet-4.6",
  version: "0.0.0",
  outputStyle: "default",
  sessionId: "11111111-1111-1111-1111-111111111111",
  sessionName: "bench-cold-start",
  cwd: "/tmp/agentline-bench",
});

function parseArgs(argv) {
  const args = { samples: DEFAULT_SAMPLES, warmup: DEFAULT_WARMUP, json: false, bin: DEFAULT_BIN };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--json") {
      args.json = true;
    } else if (a === "--samples" && argv[i + 1]) {
      args.samples = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (a === "--warmup" && argv[i + 1]) {
      args.warmup = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (a === "--bin" && argv[i + 1]) {
      args.bin = resolve(argv[i + 1]);
      i += 1;
    } else if (a === "--help" || a === "-h") {
      process.stdout.write(
        "Usage: node scripts/bench/cold-start.mjs [--samples N] [--warmup N] [--bin PATH] [--json]\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`bench: unknown argument '${a}'\n`);
      process.exit(1);
    }
  }
  if (!Number.isInteger(args.samples) || args.samples < 1) {
    process.stderr.write("bench: --samples must be a positive integer\n");
    process.exit(1);
  }
  if (!Number.isInteger(args.warmup) || args.warmup < 0) {
    process.stderr.write("bench: --warmup must be a non-negative integer\n");
    process.exit(1);
  }
  return args;
}

function timeOneRun(bin) {
  return new Promise((resolveOnce, rejectOnce) => {
    const start = process.hrtime.bigint();
    const child = spawn(process.execPath, [bin], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });

    let firstByteAt = null;
    let stderrBuf = "";

    child.stdout.once("data", () => {
      firstByteAt = process.hrtime.bigint();
    });
    child.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString("utf8");
    });
    child.once("error", rejectOnce);
    child.once("close", (code) => {
      if (code !== 0) {
        rejectOnce(
          new Error(`bench: child exited with code ${code}\nstderr: ${stderrBuf}`),
        );
        return;
      }
      if (firstByteAt === null) {
        rejectOnce(new Error("bench: child produced no stdout"));
        return;
      }
      const ns = Number(firstByteAt - start);
      resolveOnce(ns / 1_000_000); // milliseconds
    });

    child.stdin.write(PAYLOAD);
    child.stdin.end();
  });
}

function percentile(sorted, p) {
  if (sorted.length === 0) return Number.NaN;
  // Nearest-rank percentile: P=p%, rank = ceil(p/100 * N), index = rank - 1.
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank - 1, sorted.length - 1)];
}

async function runBench(args) {
  if (!existsSync(args.bin)) {
    throw new Error(`bench: bin not found at ${args.bin} (run \`npm run build\` first)`);
  }

  for (let i = 0; i < args.warmup; i += 1) {
    await timeOneRun(args.bin);
  }

  const samples = [];
  for (let i = 0; i < args.samples; i += 1) {
    samples.push(await timeOneRun(args.bin));
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((acc, x) => acc + x, 0);
  return {
    bin: args.bin,
    samples: args.samples,
    warmup: args.warmup,
    minMs: round2(sorted[0]),
    p50Ms: round2(percentile(sorted, 50)),
    p95Ms: round2(percentile(sorted, 95)),
    p99Ms: round2(percentile(sorted, 99)),
    maxMs: round2(sorted[sorted.length - 1]),
    meanMs: round2(sum / samples.length),
  };
}

function round2(x) {
  if (!Number.isFinite(x)) return x;
  return Math.round(x * 100) / 100;
}

function printHuman(result) {
  process.stdout.write(
    `cold-start bench (${result.samples} samples, ${result.warmup} warm-up)\n` +
      `  bin:   ${result.bin}\n` +
      `  min:   ${result.minMs.toFixed(2)} ms\n` +
      `  p50:   ${result.p50Ms.toFixed(2)} ms\n` +
      `  mean:  ${result.meanMs.toFixed(2)} ms\n` +
      `  p95:   ${result.p95Ms.toFixed(2)} ms\n` +
      `  p99:   ${result.p99Ms.toFixed(2)} ms\n` +
      `  max:   ${result.maxMs.toFixed(2)} ms\n`,
  );
}

async function main() {
  const args = parseArgs(process.argv);
  try {
    const result = await runBench(args);
    if (args.json) {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } else {
      printHuman(result);
    }
    process.exit(0);
  } catch (err) {
    process.stderr.write(`${err && err.message ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

main();
