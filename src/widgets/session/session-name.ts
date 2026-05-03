/**
 * `session-name` widget (§7.2). "Empty hides by default."
 */

import { defineWidget } from "../widget.js";

interface SessionNameOptions {
  readonly label?: string;
}

export const sessionNameWidget = defineWidget<SessionNameOptions>("session-name", (ctx, settings) => {
  const name = ctx.session?.sessionName ?? ctx.stdin.sessionName;
  if (!name) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${name}` };
});
