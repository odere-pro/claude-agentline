/**
 * `account-email` widget (§7.2). Mask modes per §7.2:
 *
 *   - `none`       full address
 *   - `domain`     `*@example.com`   — hides the localpart
 *   - `localpart`  `user@*`          — hides the domain
 *
 * Source order: `stdin.user.email` then the auth file fallback per
 * §7.2.1. The render-tick resolver (`loadSessionFields`) does the
 * auth-file read; this widget only consumes `ctx.session`.
 */

import { defineWidget } from "../widget.js";

type MaskMode = "none" | "domain" | "localpart";

interface AccountEmailOptions {
  readonly label?: string;
  readonly mask?: MaskMode;
}

const VALID_MASKS: ReadonlySet<MaskMode> = new Set<MaskMode>(["none", "domain", "localpart"]);

function maskEmail(email: string, mode: MaskMode): string {
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) return email;
  switch (mode) {
    case "none":
      return email;
    case "domain":
      return `*@${email.slice(at + 1)}`;
    case "localpart":
      return `${email.slice(0, at)}@*`;
  }
}

export const accountEmailWidget = defineWidget<AccountEmailOptions>(
  "account-email",
  (ctx, settings) => {
    const email = ctx.session?.accountEmail;
    if (!email) return { text: "", hidden: true };
    const requested = settings.options.mask ?? "none";
    const mask: MaskMode = VALID_MASKS.has(requested) ? requested : "none";
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${maskEmail(email, mask)}` };
  },
);

export { maskEmail };
