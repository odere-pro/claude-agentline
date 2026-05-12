/**
 * `agentline config widget <sub>` dispatcher (editor-redesign plan, step 4).
 *
 * Read-only subcommands ship first — `list` (current layout) and `catalog`
 * (available widget types). The mutating subcommands (`add`, `remove`,
 * `move`, `replace`, `set-option`) land in following releases against the
 * `src/config/mutate.ts` primitives. Each subcommand is one file under
 * `src/config/widget/`; arg-parsing throws `HelpRequestedError` for `-h`
 * and a plain `Error` (caught by the caller → exit 2) for bad arguments.
 */

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { parseWidgetCatalogArgs, runWidgetCatalogCommand } from "./widget/catalog.js";
import { parseWidgetListArgs, runWidgetListCommand } from "./widget/list.js";

const HELP = `agentline config widget — inspect and edit the statusline layout

Usage:
  agentline config widget <sub> [<options>]

Subcommands:
  list [--json]        show the current layout — lines and their widgets
  catalog [--json]     list every available widget type with a description
  help                 print this message

Mutating subcommands (add / remove / move / replace / set-option) are
planned; for now edit the config via \`agentline config\` or by hand.
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
    default:
      process.stderr.write(`agentline config widget: unknown subcommand '${sub}'\n`);
      process.stdout.write(HELP);
      return 1;
  }
}
