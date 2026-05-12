/**
 * `agentline config widget <sub>` dispatcher (editor-redesign plan, step 4).
 *
 * Read-only subcommands `list` (current layout) and `catalog` (available
 * widget types) plus the mutating subcommands `add` and `remove`, which wrap
 * the `src/config/mutate.ts` primitives (`loadConfig` → mutate → validate →
 * atomic write). `move` / `replace` / `set-option` land next. Each
 * subcommand is one file under `src/config/widget/`; arg-parsing throws
 * `HelpRequestedError` for `-h` and a plain `Error` (caught by the caller →
 * exit 2) for bad arguments.
 */

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { parseWidgetAddArgs, runWidgetAddCommand } from "./widget/add.js";
import { parseWidgetCatalogArgs, runWidgetCatalogCommand } from "./widget/catalog.js";
import { parseWidgetListArgs, runWidgetListCommand } from "./widget/list.js";
import { parseWidgetRemoveArgs, runWidgetRemoveCommand } from "./widget/remove.js";

const HELP = `agentline config widget — inspect and edit the statusline layout

Usage:
  agentline config widget <sub> [<options>]

Subcommands:
  list [--json]                  show the current layout — lines and widgets
  catalog [--json]               list every widget type with a description
  add <type> [--line N] [--at I] [--options JSON]   insert a widget
  remove [--line N] --at I       drop the widget at that position
  help                           print this message

(move / replace / set-option are planned.) Run \`agentline config widget
<sub> --help\` for per-subcommand details.
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
    default:
      process.stderr.write(`agentline config widget: unknown subcommand '${sub}'\n`);
      process.stdout.write(HELP);
      return 1;
  }
}
