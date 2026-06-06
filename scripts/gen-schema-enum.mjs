#!/usr/bin/env node
/**
 * scripts/gen-schema-enum.mjs
 *
 * Generate the `widget.type` enum in `schemas/config.schema.json` from the
 * widget catalogue (`src/widgets/families/catalog.ts`), so the schema's
 * accepted widget-type list is derived from the single source of truth
 * rather than hand-maintained. Run as a `prebuild` step (and by the
 * gate-28 sync check); adding or removing a widget regenerates the enum
 * with no schema edit.
 *
 * Usage:
 *   node scripts/gen-schema-enum.mjs          # rewrite the schema in place
 *   node scripts/gen-schema-enum.mjs --check  # exit 1 if the schema is stale
 *
 * The catalogue is TypeScript, so we bundle it to an in-memory ESM module
 * with esbuild and import it — no compiled `dist/` prerequisite, and the
 * import graph stays render-reachable (gate-19-safe) because `catalog.ts`
 * already is.
 */

import { build } from "esbuild";
import prettier from "prettier";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const SCHEMA_PATH = resolve(REPO_ROOT, "schemas/config.schema.json");
const CATALOG_ENTRY = resolve(REPO_ROOT, "src/widgets/families/catalog.ts");

/** Bundle the catalogue and return its sorted widget-type keys. */
async function widgetTypes() {
  const result = await build({
    entryPoints: [CATALOG_ENTRY],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  const mod = await import(dataUrl);
  return Object.keys(mod.WIDGET_CATALOG).sort();
}

/** Read the schema as text, returning { json, text }. */
async function readSchema() {
  const text = await readFile(SCHEMA_PATH, "utf8");
  return { json: JSON.parse(text), text };
}

/**
 * Inject the enum into the parsed schema and return prettier-formatted JSON
 * text, so the generated file matches `prettier --write` (gate-05) exactly
 * and the `--check` mode is stable across runs.
 */
async function withEnum(json, types) {
  const widget = json.definitions?.widget;
  if (!widget?.properties?.type) {
    throw new Error("gen-schema-enum: schema is missing definitions.widget.properties.type");
  }
  // Preserve `type: "string"`; replace the loose `minLength` constraint with
  // the catalogue-derived enum. (The enum already implies non-empty.)
  widget.properties.type = { type: "string", enum: types };
  return prettier.format(JSON.stringify(json), {
    ...(await prettier.resolveConfig(SCHEMA_PATH)),
    filepath: SCHEMA_PATH,
  });
}

async function main() {
  const check = process.argv.includes("--check");
  const types = await widgetTypes();
  const { json, text } = await readSchema();
  const next = await withEnum(json, types);

  if (check) {
    if (text !== next) {
      process.stderr.write(
        "gen-schema-enum: schemas/config.schema.json is stale — run `node scripts/gen-schema-enum.mjs`\n",
      );
      process.exit(1);
    }
    process.stdout.write(`gen-schema-enum: schema enum in sync (${types.length} types)\n`);
    return;
  }

  await writeFile(SCHEMA_PATH, next);
  process.stdout.write(`gen-schema-enum: wrote ${types.length} widget types into the schema\n`);
}

main().catch((err) => {
  process.stderr.write(`gen-schema-enum: ${err.message}\n`);
  process.exit(1);
});
