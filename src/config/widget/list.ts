/**
 * Body for `agentline config widget list [--json]` (editor-redesign plan, step 4).
 *
 * Prints the current statusline layout — each line and, per widget, its
 * index, type, hidden/raw/merge flags, and options. The merged config is
 * shown (defaults + user file + env), i.e. exactly what renders. The JSON
 * form is the surface the in-session config-helper skill reads before
 * editing the layout.
 */

import { isHelpFlag, requestHelp } from "../../cli/help.js";
import { loadConfig } from "../load.js";
import type { AgentlineConfig } from "../types.js";

const HELP = `agentline config widget list — show the current statusline layout

Usage:
  agentline config widget list [--json]

Options:
  --json      emit machine-readable JSON ({ lines: [{ line, widgets: [{ at, type, ... }] }] })
  -h, --help  show this message
`;

export interface WidgetListArgs {
  readonly json: boolean;
}

export interface WidgetListInput {
  readonly args: WidgetListArgs;
  readonly env?: NodeJS.ProcessEnv;
  /** Inject a config instead of loading it from disk — for tests. */
  readonly config?: AgentlineConfig;
}

export async function runWidgetListCommand(input: WidgetListInput): Promise<number> {
  const config = input.config ?? (await loadConfig({ env: input.env })).config;
  process.stdout.write(input.args.json ? formatJson(config) : formatText(config));
  return 0;
}

export function formatJson(config: AgentlineConfig): string {
  const lines = config.lines.map((line, i) => ({
    line: i,
    widgets: line.widgets.map((w, at) => ({ at, ...w })),
  }));
  return `${JSON.stringify({ lines }, null, 2)}\n`;
}

export function formatText(config: AgentlineConfig): string {
  const out: string[] = ["agentline layout:", ""];
  if (config.lines.length === 0) {
    out.push("  (no lines configured)", "");
    return out.join("\n");
  }
  config.lines.forEach((line, i) => {
    out.push(`  line ${i}:`);
    if (line.widgets.length === 0) {
      out.push("    (empty)");
      return;
    }
    line.widgets.forEach((w, at) => {
      const flags: string[] = [];
      if (w.hidden) flags.push("hidden");
      if (w.rawValue) flags.push("raw");
      if (w.merged && w.merged !== "off") flags.push(w.merged);
      const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
      const opts =
        w.options && Object.keys(w.options).length > 0 ? ` ${JSON.stringify(w.options)}` : "";
      out.push(`    ${String(at).padStart(2, " ")}  ${w.type}${flagStr}${opts}`);
    });
  });
  out.push("");
  return out.join("\n");
}

export function parseWidgetListArgs(rest: readonly string[]): WidgetListArgs {
  let json = false;
  for (const arg of rest) {
    if (arg === "--json") json = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else if (arg) throw new Error(`agentline config widget list: unknown argument '${arg}'`);
  }
  return { json };
}
