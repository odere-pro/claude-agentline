/**
 * `agent-name` widget (session family).
 *
 * Renders the active subagent persona name from `ctx.stdin.agentName`
 * (the host's `agent.name`). Present while a named subagent is driving
 * the session; hidden on the main agent. Pure `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import type { WidgetContext } from "../../types.js";

interface AgentNameOptions {
  readonly label?: string;
}

export const agentNameWidget = defineWidget<AgentNameOptions>(
  "agent-name",
  (ctx: WidgetContext, settings): Cell => {
    const name = ctx.stdin.agentName;
    if (!name) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${name}` };
  },
);
