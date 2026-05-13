/**
 * Body for `agentline config widget catalog [--json] [--preview]` (editor-redesign
 * plan, step 4 + step 5).
 *
 * Lists every registered widget type with its human name, one-line
 * description, and family — the discovery surface the in-session
 * config-helper skill reads before suggesting widgets. With `--preview`,
 * each entry also carries what the widget renders against the synthetic
 * demo session (`src/render/demo-fixture.ts`). JSON form is the structured
 * payload; text form groups by family in reading order.
 */

import { isHelpFlag, requestHelp } from "../../cli/help.js";
import { previewWidget } from "../../render/demo-fixture.js";
import {
  WIDGET_CATEGORIES,
  defaultRegistry,
  registerAllBuiltins,
  type WidgetMetaEntry,
} from "../../widgets/index.js";

const HELP = `agentline config widget catalog — list available widget types

Usage:
  agentline config widget catalog [--json] [--preview]

Options:
  --json      emit machine-readable JSON ({ widgets: [{ type, name, description, category, preview? }] })
  --preview   include what each widget renders against the demo session
  -h, --help  show this message
`;

export interface WidgetCatalogArgs {
  readonly json: boolean;
  readonly preview: boolean;
}

export interface WidgetCatalogInput {
  readonly args: WidgetCatalogArgs;
  /** Inject entries instead of reading the registry — for tests. */
  readonly entries?: readonly WidgetMetaEntry[];
}

export async function runWidgetCatalogCommand(input: WidgetCatalogInput): Promise<number> {
  const entries = input.entries ?? builtinMeta();
  const opts = { preview: input.args.preview };
  process.stdout.write(input.args.json ? formatJson(entries, opts) : formatText(entries, opts));
  return 0;
}

/** Catalogued metadata for the built-in widgets, populating the default registry once. */
export function builtinMeta(): readonly WidgetMetaEntry[] {
  const registry = defaultRegistry();
  if (registry.size() === 0) registerAllBuiltins(registry);
  return registry.listMeta();
}

interface FormatOptions {
  readonly preview: boolean;
}

/** What a widget renders against the demo session; `""` when it hides itself. */
function previewText(type: string): string {
  return previewWidget(type).text;
}

export function formatJson(
  entries: readonly WidgetMetaEntry[],
  opts: FormatOptions = { preview: false },
): string {
  const widgets = entries.map((e) => ({
    type: e.type,
    name: e.name,
    description: e.description,
    category: e.category,
    ...(opts.preview ? { preview: previewText(e.type) } : {}),
  }));
  return `${JSON.stringify({ widgets }, null, 2)}\n`;
}

export function formatText(
  entries: readonly WidgetMetaEntry[],
  opts: FormatOptions = { preview: false },
): string {
  const out: string[] = [`agentline widgets (${entries.length}):`, ""];
  const widest = entries.reduce((n, e) => Math.max(n, e.type.length), 0);
  for (const category of WIDGET_CATEGORIES) {
    const inCategory = entries.filter((e) => e.category === category);
    if (inCategory.length === 0) continue;
    out.push(`  ${category} (${inCategory.length}):`);
    for (const e of inCategory) {
      const tail = opts.preview ? `${e.description}  →  ${previewText(e.type) || "(hidden)"}` : e.description;
      out.push(`    ${e.type.padEnd(widest, " ")}  ${tail}`);
    }
    out.push("");
  }
  return out.join("\n");
}

export function parseWidgetCatalogArgs(rest: readonly string[]): WidgetCatalogArgs {
  let json = false;
  let preview = false;
  for (const arg of rest) {
    if (arg === "--json") json = true;
    else if (arg === "--preview") preview = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else if (arg) throw new Error(`agentline config widget catalog: unknown argument '${arg}'`);
  }
  return { json, preview };
}
