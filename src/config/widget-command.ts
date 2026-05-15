/**
 * `agentline config widget <sub>` dispatcher (editor-redesign plan, step 4).
 *
 * Read-only subcommands `list` (current layout) and `catalog` (available
 * widget types), plus the mutating subcommands `add`, `remove`, `move`,
 * `replace`, and `set-option`, which wrap the `src/config/mutate.ts`
 * primitives (`loadConfig` → mutate → validate → atomic write). Each
 * subcommand is one file under `src/config/widget/`; arg-parsing throws
 * `HelpRequestedError` for `-h` and a plain `Error` (caught by the caller →
 * exit 2) for bad arguments.
 *
 * The `WIDGET_SUBS` table is the single source of truth for "is this a known
 * subcommand?" — mirroring the convention used by `COMMANDS` in `src/cli.ts`.
 * Each entry pairs a parser with a runner; their argument shapes match by
 * construction even though the static type is erased to `unknown` in the
 * map.
 */

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { parseWidgetAddArgs, runWidgetAddCommand } from "./widget/add.js";
import { parseWidgetCatalogArgs, runWidgetCatalogCommand } from "./widget/catalog.js";
import { parseWidgetListArgs, runWidgetListCommand } from "./widget/list.js";
import { parseWidgetMoveArgs, runWidgetMoveCommand } from "./widget/move.js";
import { parseWidgetRemoveArgs, runWidgetRemoveCommand } from "./widget/remove.js";
import { parseWidgetReplaceArgs, runWidgetReplaceCommand } from "./widget/replace.js";
import { parseWidgetSetOptionArgs, runWidgetSetOptionCommand } from "./widget/set-option.js";

const HELP = `agentline config widget — inspect and edit the statusline layout

Usage:
  agentline config widget <sub> [<options>]

Subcommands:
  list [--json]                          show the current layout
  catalog [--json]                       list every widget type + description
  add <type> [--line N] [--at I] [--options JSON]    insert a widget
  remove [--line N] --at I               drop the widget at that position
  move [--from-line N] --from-at I [--to-line M] [--to-at J]   reorder a widget
  replace <type> [--line N] --at I [--options JSON]  swap the widget at a position
  set-option <key> <value> [--line N] --at I [--json]   set one widget option
  help                                   print this message

Run \`agentline config widget <sub> --help\` for per-subcommand details.
`;

interface WidgetSub<TArgs> {
  readonly parse: (rest: readonly string[]) => TArgs;
  readonly run: (input: { readonly args: TArgs }) => Promise<number>;
}

/**
 * Bundle a typed `parse` / `run` pair into a `WidgetSub<unknown>` entry.
 * The single cast happens here, where TS can still see that both halves
 * agree on `TArgs` — passing e.g. `parseWidgetRemoveArgs` with
 * `runWidgetAddCommand` is a compile error inside this function call.
 */
export function defineWidgetSub<TArgs>(
  parse: (rest: readonly string[]) => TArgs,
  run: (input: { readonly args: TArgs }) => Promise<number>,
): WidgetSub<unknown> {
  return Object.freeze({ parse, run }) as unknown as WidgetSub<unknown>;
}

export const WIDGET_SUBS: Readonly<Record<string, WidgetSub<unknown>>> = Object.freeze({
  list: defineWidgetSub(parseWidgetListArgs, runWidgetListCommand),
  catalog: defineWidgetSub(parseWidgetCatalogArgs, runWidgetCatalogCommand),
  add: defineWidgetSub(parseWidgetAddArgs, runWidgetAddCommand),
  remove: defineWidgetSub(parseWidgetRemoveArgs, runWidgetRemoveCommand),
  move: defineWidgetSub(parseWidgetMoveArgs, runWidgetMoveCommand),
  replace: defineWidgetSub(parseWidgetReplaceArgs, runWidgetReplaceCommand),
  "set-option": defineWidgetSub(parseWidgetSetOptionArgs, runWidgetSetOptionCommand),
});

export async function runWidgetSubgroup(rest: readonly string[]): Promise<number> {
  const sub = rest[0];
  if (sub === undefined || isHelpFlag(sub) || sub === "help") {
    requestHelp(HELP);
  }
  const handler = WIDGET_SUBS[sub];
  if (!handler) {
    process.stderr.write(`agentline config widget: unknown subcommand '${sub}'\n`);
    process.stdout.write(HELP);
    return 1;
  }
  const subRest = rest.slice(1);
  return handler.run({ args: handler.parse(subRest) });
}
