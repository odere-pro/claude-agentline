/**
 * `login-method` widget (§7.2). Renders one of `oauth` / `api-key`
 * / `enterprise` (or the raw value if it differs); hidden when no
 * source has it.
 */

import { defineWidget } from "../widget.js";

interface LoginMethodOptions {
  readonly label?: string;
}

const KNOWN_METHODS: Readonly<Record<string, string>> = Object.freeze({
  oauth: "oauth",
  "api-key": "api-key",
  api_key: "api-key",
  enterprise: "enterprise",
});

function normalise(method: string): string {
  const key = method.toLowerCase().trim();
  return KNOWN_METHODS[key] ?? method;
}

export const loginMethodWidget = defineWidget<LoginMethodOptions>(
  "login-method",
  (ctx, settings) => {
    const method = ctx.session?.loginMethod;
    if (!method) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${normalise(method)}` };
  },
);
