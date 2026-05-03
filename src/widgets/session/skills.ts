/**
 * `skills` widget (§7.2). Display variant cycled by `v` in the TUI:
 *
 *   - `count`  `N`           (default)
 *   - `list`   `a, b, c`     comma-joined names
 *   - `last`   `c`           last entry only
 *
 * Source: `stdin.skills`. Hidden when there are no skills to display.
 */

import { defineWidget } from "../widget.js";

type SkillsVariant = "count" | "list" | "last";

interface SkillsOptions {
  readonly label?: string;
  readonly variant?: SkillsVariant;
  readonly listSeparator?: string;
}

const VALID_VARIANTS: ReadonlySet<SkillsVariant> = new Set<SkillsVariant>(["count", "list", "last"]);

function render(variant: SkillsVariant, skills: readonly string[], separator: string): string {
  if (skills.length === 0) return "";
  switch (variant) {
    case "count":
      return String(skills.length);
    case "list":
      return skills.join(separator);
    case "last":
      return skills[skills.length - 1] ?? "";
  }
}

export const skillsWidget = defineWidget<SkillsOptions>("skills", (ctx, settings) => {
  const skills = ctx.session?.skills ?? [];
  if (skills.length === 0) return { text: "", hidden: true };
  const requested = settings.options.variant ?? "count";
  const variant: SkillsVariant = VALID_VARIANTS.has(requested) ? requested : "count";
  const separator = settings.options.listSeparator ?? ", ";
  const text = render(variant, skills, separator);
  if (!text) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${text}` };
});
