#!/usr/bin/env node
/**
 * scripts/check-host-contract.mjs
 *
 * Host-contract conformance check (issue #245). Productizes the manual
 * `agentline-claude-code-watcher` local-diff into a deterministic check:
 * assert that agentline's knowledge of the Claude Code statusline payload —
 * spread across the adapter and every downstream `raw[...]` reader — stays in
 * sync with both a captured live payload fixture and the human-readable table
 * in `docs/cookbook/06-data-contracts.md`.
 *
 * Usage:
 *   node scripts/check-host-contract.mjs           # validate, exit 1 on drift
 *   node scripts/check-host-contract.mjs --check    # identical; flag accepted
 *                                                   # for parity with gate-28
 *
 * Env overrides (used by the gate-29 selftest to point at synthetic drift):
 *   HOST_CONTRACT_FIXTURE   path to the payload JSON fixture
 *   HOST_CONTRACT_DOC       path to the data-contracts markdown
 *
 * How "consumed" is derived (the load-bearing trick): the fixture is wrapped
 * in a recording Proxy whose get-trap notes every top-level key the code
 * touches, then we run EVERY module that reads `raw[...]` against it. "Consumed
 * = the top-level keys agentline actually reads for this representative
 * payload" — tied to real behaviour, not a hand-maintained list. The `??`
 * fallbacks mean back-compat-only keys (`vim_mode`, flat `model`) are not
 * exercised when the modern block is present; that is intentional (the fixture
 * is the modern shape).
 *
 * Assertions:
 *   A1 (drift)        every fixture top-level key is consumed or explicitly ignored
 *   A2 (over-capture) no ignored key shows up as consumed (catches a `{...raw}`
 *                     / `Object.entries(raw)` refactor that would neuter A1)
 *   ENUM (readers)    the set of modules that read `raw[...]` equals the set the
 *                     harness exercises (a new reader fails until it is wired in)
 *   B (doc sync)      the doc table's `Raw key` column equals the consumed keys
 *                     the host actually sends (no phantom rows, no missing rows)
 *
 * The bundling mirrors `gen-schema-enum.mjs`: esbuild → in-memory ESM import,
 * so there is no compiled `dist/` prerequisite and the graph stays
 * render-reachable (gate-19-safe).
 */

import { build } from "esbuild";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");

const FIXTURE_PATH =
  process.env.HOST_CONTRACT_FIXTURE ?? resolve(REPO_ROOT, "tests/fixtures/host-payload-2.1.193.json");
const DOC_PATH =
  process.env.HOST_CONTRACT_DOC ?? resolve(REPO_ROOT, "docs/cookbook/06-data-contracts.md");

/**
 * Top-level keys the host sends that agentline intentionally does NOT read.
 * A key here is exempt from the "must be consumed" drift check (A1) — but A2
 * asserts it never sneaks into the consumed set, so this stays honest.
 */
const IGNORED = new Set([
  // Hook envelope marker (always "Status" for the statusline hook). Not a
  // statusline datum; nothing to surface.
  "hook_event_name",
]);

/**
 * Every module that reads a top-level key off `raw` / `payload.raw` /
 * `ctx.stdin.raw`. The ENUM assertion below greps the source for this exact
 * set, so a new reader module fails CI until it is added here AND exercised in
 * `runReaders` — closing the "a widget reads raw[...] and the harness misses
 * it" hole permanently.
 */
const EXERCISED_READERS = [
  "src/core/stdin/index.ts",
  "src/data/session/index.ts",
  "src/widgets/rate-limits/usage.ts",
];

/** Bundle one TS entry to an in-memory ESM module and import it. */
async function bundleModule(relPath) {
  const result = await build({
    entryPoints: [resolve(REPO_ROOT, relPath)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  return import(dataUrl);
}

/** A Proxy over `target` that records each top-level string key accessed. */
function recordingProxy(target, recorded) {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (typeof prop === "string") recorded.add(prop);
      return Reflect.get(obj, prop, receiver);
    },
    has(obj, prop) {
      if (typeof prop === "string") recorded.add(prop);
      return Reflect.has(obj, prop);
    },
  });
}

/** Run every raw-reader against the proxied fixture; return the consumed set. */
async function deriveConsumed(fixture) {
  const recorded = new Set();
  const proxy = recordingProxy(fixture, recorded);

  const [stdinMod, sessionMod, usageMod] = await Promise.all([
    bundleModule("src/core/stdin/index.ts"),
    bundleModule("src/data/session/index.ts"),
    bundleModule("src/widgets/rate-limits/usage.ts"),
  ]);

  // Reader 1: the adapter. Returns a payload whose `.raw` IS the proxy.
  const payload = stdinMod.adaptStatuslinePayload(proxy);

  // Reader 2: the session resolver reads payload.raw["user"] / ["skills"].
  // Pass `null` auth so it never touches the filesystem (resolveSessionFields,
  // not loadSessionFields).
  sessionMod.resolveSessionFields({ raw: proxy, truncated: false }, null);

  // Reader 3: the session-weekly-usage widget reads ctx.stdin.raw["plan"].
  // Build a minimal-but-sufficient context; the fixture's rate_limits keep it
  // past the early hide so it reaches resolvePlan.
  const ctx = {
    stdin: payload,
    config: { global: { valueSeparator: "·" } },
    theme: null,
    clock: { now: () => new Date("2026-01-01T00:00:00Z"), timeZone: "UTC" },
    env: {},
  };
  try {
    usageMod.sessionWeeklyUsageWidget.render(ctx, { options: {}, rawValue: false });
  } catch {
    // We only care about which raw keys it touched, not the rendered cell.
  }

  return recorded;
}

/** Recursively list `*.ts` files under `dir` (absolute paths), skipping tests. */
async function listTsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listTsFiles(full)));
    } else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** The set of source files (repo-relative) that read a top-level key off raw. */
async function discoverReaders() {
  const files = await listTsFiles(resolve(REPO_ROOT, "src"));
  // `raw["…"]` (covers raw[, payload.raw[, ctx.stdin.raw[) or a pick*(… raw, "…")
  // call. Word-anchored so `straw[` / identifiers don't match.
  const re = /\braw\[|\(\s*(?:payload\.|ctx\.stdin\.)?raw\s*,\s*["']/;
  const hits = new Set();
  for (const f of files) {
    const text = await readFile(f, "utf8");
    if (re.test(text)) hits.add(relative(REPO_ROOT, f).split("\\").join("/"));
  }
  return hits;
}

/** Parse the `Raw key` column of the "Host stdin contract" table. */
async function docRawKeys() {
  const text = await readFile(DOC_PATH, "utf8");
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^##\s+Host stdin contract\s*$/.test(l));
  if (start === -1) throw new Error(`no "## Host stdin contract" section in ${DOC_PATH}`);

  let header = null;
  let rawIdx = -1;
  const keys = new Set();
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break; // next section ends the table scan
    if (!line.trimStart().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (!header) {
      header = cells;
      rawIdx = header.findIndex((c) => c.toLowerCase() === "raw key");
      if (rawIdx === -1) throw new Error(`host-stdin table has no "Raw key" column in ${DOC_PATH}`);
      continue;
    }
    if (cells.every((c) => /^-+$/.test(c) || c === "")) continue; // separator row
    const cell = (cells[rawIdx] ?? "").replace(/`/g, "").trim();
    if (cell && cell !== "—") keys.add(cell);
  }
  return keys;
}

function sortedList(set) {
  return [...set].sort();
}

function diff(a, b) {
  return [...a].filter((x) => !b.has(x)).sort();
}

async function main() {
  const fixtureText = await readFile(FIXTURE_PATH, "utf8");
  const fixture = JSON.parse(fixtureText);
  const fixtureKeys = new Set(Object.keys(fixture));

  const consumed = await deriveConsumed(fixture);
  const readers = await discoverReaders();
  const documented = await docRawKeys();

  const failures = [];

  // ENUM — the harness exercises exactly the modules that read raw.
  const newReaders = diff(readers, new Set(EXERCISED_READERS));
  const goneReaders = diff(new Set(EXERCISED_READERS), readers);
  if (newReaders.length) {
    failures.push(
      `new raw-reader module(s) not exercised by the harness: ${newReaders.join(", ")} — ` +
        `add them to EXERCISED_READERS in scripts/check-host-contract.mjs and run them in deriveConsumed()`,
    );
  }
  if (goneReaders.length) {
    failures.push(
      `harness lists reader(s) that no longer read raw: ${goneReaders.join(", ")} — ` +
        `remove them from EXERCISED_READERS`,
    );
  }

  // A1 — every host-sent key is consumed or explicitly ignored.
  const undrained = [...fixtureKeys].filter((k) => !consumed.has(k) && !IGNORED.has(k)).sort();
  if (undrained.length) {
    failures.push(
      `host sends key(s) nothing reads and the allowlist doesn't cover: ${undrained.join(", ")} — ` +
        `map them in the adapter (or a downstream reader), or add to IGNORED with a reason`,
    );
  }

  // A2 — no ignored key leaked into consumed (spread/entries over-capture).
  const leaked = [...IGNORED].filter((k) => consumed.has(k)).sort();
  if (leaked.length) {
    failures.push(
      `ignored key(s) appear as consumed: ${leaked.join(", ")} — ` +
        `did a reader start spreading or iterating all of raw? that neuters the drift check`,
    );
  }

  // B — doc `Raw key` column equals the consumed keys the host actually sends.
  const sentAndConsumed = new Set([...consumed].filter((k) => fixtureKeys.has(k)));
  const missingRows = diff(sentAndConsumed, documented);
  const phantomRows = diff(documented, sentAndConsumed);
  if (missingRows.length) {
    failures.push(
      `06-data-contracts.md is missing Raw key row(s) for consumed host field(s): ${missingRows.join(", ")}`,
    );
  }
  if (phantomRows.length) {
    failures.push(
      `06-data-contracts.md has phantom Raw key row(s) not consumed/sent: ${phantomRows.join(", ")}`,
    );
  }

  if (failures.length) {
    process.stderr.write("host-contract: conformance FAILED\n");
    for (const f of failures) process.stderr.write(`  - ${f}\n`);
    process.stderr.write(
      `\n  consumed:   ${sortedList(consumed).join(", ")}\n` +
        `  documented: ${sortedList(documented).join(", ")}\n` +
        `  ignored:    ${sortedList(IGNORED).join(", ")}\n`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `host-contract: in sync — ${sentAndConsumed.size} documented host fields, ` +
      `${readers.size} raw-reader module(s), ${IGNORED.size} ignored\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`host-contract: ${err.message}\n`);
  process.exit(1);
});
