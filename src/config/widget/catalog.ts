/**
 * Body for `agentline config widget catalog [--json]`.
 *
 * Lists every registered widget type with its human name, one-line
 * description, and category — the discovery surface the in-session
 * configure skill reads before suggesting widgets. JSON form is the
 * structured payload; text form groups by category in reading order.
 *
 * No preview column: the demo-fixture that backed an earlier `--preview`
 * was retired, and the TUI picker (`agentline edit`) is the real preview
 * surface. Keeping this command stable, fast, and side-effect-free.
 */

import { isHelpFlag, requestHelp } from "../../cli/help.js";
import {
  WIDGET_CATEGORIES,
  defaultRegistry,
  registerAllBuiltins,
  type WidgetMetaEntry,
} from "../../widgets/index.js";

const HELP = `agentline config widget catalog — list available widget types

Usage:
  agentline config widget catalog [--json]

Options:
  --json      emit machine-readable JSON ({ widgets: [{ type, name, description, category }] })
  -h, --help  show this message
`;

export interface WidgetCatalogArgs {
  readonly json: boolean;
}

export interface WidgetCatalogInput {
  readonly args: WidgetCatalogArgs;
  /** Inject entries instead of reading the registry — for tests. */
  readonly entries?: readonly WidgetMetaEntry[];
}

export async function runWidgetCatalogCommand(input: WidgetCatalogInput): Promise<number> {
  const entries = input.entries ?? builtinMeta();
  process.stdout.write(input.args.json ? formatJson(entries) : formatText(entries));
  return 0;
}

/** Catalogued metadata for the built-in widgets, populating the default registry once. */
export function builtinMeta(): readonly WidgetMetaEntry[] {
  const registry = defaultRegistry();
  if (registry.size() === 0) registerAllBuiltins(registry);
  return registry.listMeta();
}

export function formatJson(entries: readonly WidgetMetaEntry[]): string {
  const widgets = entries.map((e) => ({
    type: e.type,
    name: e.name,
    description: e.description,
    category: e.category,
  }));
  return `${JSON.stringify({ widgets }, null, 2)}\n`;
}

export function formatText(entries: readonly WidgetMetaEntry[]): string {
  const out: string[] = [`agentline widgets (${entries.length}):`, ""];
  const widest = entries.reduce((n, e) => Math.max(n, e.type.length), 0);
  for (const category of WIDGET_CATEGORIES) {
    const inCategory = entries.filter((e) => e.category === category);
    if (inCategory.length === 0) continue;
    out.push(`  ${category} (${inCategory.length}):`);
    for (const e of inCategory) {
      out.push(`    ${e.type.padEnd(widest, " ")}  ${e.description}`);
    }
    out.push("");
  }
  return out.join("\n");
}

export function parseWidgetCatalogArgs(rest: readonly string[]): WidgetCatalogArgs {
  let json = false;
  for (const arg of rest) {
    if (arg === "--json") json = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else if (arg) throw new Error(`agentline config widget catalog: unknown argument '${arg}'`);
  }
  return { json };
}
