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

export async function runWidgetSubgroup(rest: readonly string[]): Promise<number> {
  const sub = rest[0];
  if (sub === undefined || isHelpFlag(sub) || sub === "help") {
    requestHelp(HELP);
  }
  const subRest = rest.slice(1);
  switch (sub) {
    case "list":
      return runWidgetListCommand({ args: parseWidgetListArgs(subRest) });
    case "catalog":
      return runWidgetCatalogCommand({ args: parseWidgetCatalogArgs(subRest) });
    case "add":
      return runWidgetAddCommand({ args: parseWidgetAddArgs(subRest) });
    case "remove":
      return runWidgetRemoveCommand({ args: parseWidgetRemoveArgs(subRest) });
    case "move":
      return runWidgetMoveCommand({ args: parseWidgetMoveArgs(subRest) });
    case "replace":
      return runWidgetReplaceCommand({ args: parseWidgetReplaceArgs(subRest) });
    case "set-option":
      return runWidgetSetOptionCommand({ args: parseWidgetSetOptionArgs(subRest) });
    default:
      process.stderr.write(`agentline config widget: unknown subcommand '${sub}'\n`);
      process.stdout.write(HELP);
      return 1;
  }
}
