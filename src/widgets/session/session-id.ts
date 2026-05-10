/**
 * `session-id` widget (§7.2). Truncated to 8 chars by default;
 * `options.length` configurable. Hidden when stdin omits sessionId.
 */

import { defineWidget } from "../widget.js";

interface SessionIdOptions {
  readonly label?: string;
  readonly length?: number;
}

const DEFAULT_LENGTH = 8;

export const sessionIdWidget = defineWidget<SessionIdOptions>("session-id", (ctx, settings) => {
  const id = ctx.session?.sessionId ?? ctx.stdin.sessionId;
  if (!id) return { text: "", hidden: true };
  const len = Number.isInteger(settings.options.length) && (settings.options.length ?? 0) > 0
    ? settings.options.length! // safe: Number.isInteger() guard above ensures this is a defined positive integer
    : DEFAULT_LENGTH;
  const truncated = id.slice(0, len);
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${truncated}` };
});
