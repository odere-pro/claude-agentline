/**
 * `org` widget (§7.2). Source: `stdin.user.org.slug` (resolver
 * surfaces this on `ctx.session.orgSlug`); hidden when missing.
 */

import { defineWidget } from "../widget.js";

interface OrgOptions {
  readonly label?: string;
}

export const orgWidget = defineWidget<OrgOptions>("org", (ctx, settings) => {
  const slug = ctx.session?.orgSlug;
  if (!slug) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${slug}` };
});
