/**
 * Widget catalogue — human-readable metadata for every built-in widget
 * (PR-PLAN follow-up; supports the TUI picker and `agentline config widget
 * catalog`).
 *
 * The render-path contract (`WidgetDef = { type, render }`) stays minimal:
 * the renderer never needs a widget's display name. Metadata lives here, in
 * one auditable place, keyed by the same `type` string the registry uses.
 * `category` mirrors the source-tree family (`src/widgets/<category>/`).
 *
 * Invariants (enforced by `catalog.test.ts`):
 *   - every built-in registered type has exactly one entry here;
 *   - no entry names a type that is not a built-in;
 *   - every `description` is non-empty and ≤ 80 characters;
 *   - every `category` is one of `WIDGET_CATEGORIES`.
 */

export const WIDGET_CATEGORIES = [
  "session",
  "tokens",
  "context",
  "rate-limits",
  "git",
  "time",
  "custom",
] as const;

export type WidgetCategory = (typeof WIDGET_CATEGORIES)[number];

/**
 * A *variant* is a named alternative way a single widget can render itself —
 * the same data shown differently. Skills can show a count, a list, or just
 * the last entry. Session-usage can show a percent, a long bar, or a short
 * one. The variant's `options` is a patch merged into `WidgetConfig.options`
 * when the user picks it; widgets without distinct rendering modes carry no
 * variants and the picker skips that step.
 */
export interface WidgetVariant {
  /** Stable identifier — e.g. "count", "bar", "short-bar". */
  readonly id: string;
  /** Human label for the picker. */
  readonly label: string;
  /** Patch merged into `WidgetConfig.options` on pick. */
  readonly options: Readonly<Record<string, unknown>>;
}

export interface WidgetMeta {
  /** Human label, e.g. "Git branch". */
  readonly name: string;
  /** One-line summary of what the widget renders; ≤ 80 chars. */
  readonly description: string;
  /** Source-tree family the widget belongs to. */
  readonly category: WidgetCategory;
  /**
   * Optional fixture key the picker uses to render a representative
   * preview cell. Wired by the demo-fixture work; unset means "use the
   * shared demo context".
   */
  readonly previewFixture?: string;
  /**
   * Named alternative rendering modes for this widget. Omit (or empty) when
   * the widget has only one rendering. The editor surfaces these in step 3
   * of the picker and as the targets of the `u` (update) verb.
   */
  readonly variants?: readonly WidgetVariant[];
}

/** A catalogue entry paired with the `type` it describes. */
export type WidgetMetaEntry = WidgetMeta & { readonly type: string };

function entry(
  name: string,
  description: string,
  category: WidgetCategory,
  variants?: readonly WidgetVariant[],
): WidgetMeta {
  if (variants !== undefined) {
    return Object.freeze({
      name,
      description,
      category,
      variants: Object.freeze(variants.map((v) => Object.freeze({ ...v, options: Object.freeze({ ...v.options }) }))),
    });
  }
  return Object.freeze({ name, description, category });
}

/** Variants declared in code, by widget type. Keeps the catalogue table compact. */
function v(id: string, label: string, options: Readonly<Record<string, unknown>>): WidgetVariant {
  return { id, label, options };
}

/** Canonical metadata for every built-in widget, keyed by `type`. */
export const WIDGET_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  // Session (11)
  model: entry("Model", "Active model id (e.g. Sonnet 4.6)", "session"),
  version: entry("Version", "Claude Code version", "session"),
  "output-style": entry("Output style", "Active output style", "session"),
  "session-id": entry("Session id", "Short session id", "session"),
  "session-name": entry("Session name", "Session name, or the short id when unset", "session"),
  "account-email": entry("Account email", "Logged-in account email", "session", [
    v("full", "Full address", { mask: "none" }),
    v("domain", "Domain only (@example.com)", { mask: "domain" }),
    v("localpart", "Local part only (user)", { mask: "localpart" }),
  ]),
  "login-method": entry("Login method", "Auth method: oauth, api-key, or device", "session"),
  org: entry("Organisation", "Active organisation name", "session"),
  "thinking-effort": entry(
    "Thinking effort",
    "Thinking-effort tier: low, medium, or high",
    "session",
  ),
  "vim-mode": entry(
    "Vim mode",
    "Current vim mode when vim keybindings are active",
    "session",
    [
      v("long", "Long (NORMAL / INSERT / VISUAL)", { format: "long" }),
      v("short", "Short (N / I / V)", { format: "short" }),
      v("bracket", "Bracketed ([N] / [I] / [V])", { format: "bracket" }),
    ],
  ),
  skills: entry("Skills", "Skills attached to the session", "session", [
    v("count", "Count (just the number)", { variant: "count" }),
    v("list", "List (comma-joined)", { variant: "list" }),
    v("last", "Last (most recent only)", { variant: "last" }),
  ]),
  // Tokens & cost (8)
  "tokens-total": entry("Tokens (total)", "Running token total for the chosen reset axis", "tokens"),
  "tokens-input": entry("Tokens (input)", "Input-token subtotal for the chosen reset axis", "tokens"),
  "tokens-output": entry(
    "Tokens (output)",
    "Output-token subtotal for the chosen reset axis",
    "tokens",
  ),
  "tokens-cached": entry("Tokens (cached)", "Cached-token subtotal (prompt-cache hits)", "tokens"),
  cost: entry("Cost", "Running USD cost from the embedded pricing table", "tokens"),
  "input-speed": entry("Input speed", "Input tokens per second over the active window", "tokens"),
  "output-speed": entry("Output speed", "Output tokens per second over the active window", "tokens"),
  "total-speed": entry("Total speed", "Combined token throughput per second", "tokens"),

  // Context (4)
  "context-length": entry("Context length", "Tokens currently in the context window", "context"),
  "context-percentage": entry(
    "Context %",
    "Percentage of the model's context window in use",
    "context",
  ),
  "context-percentage-usable": entry(
    "Context % (usable)",
    "Percentage of usable context in use (excludes output budget)",
    "context",
  ),
  "context-bar": entry("Context bar", "Tiny inline bar approximating context fill", "context"),

  // Rate limits (8)
  "session-usage": entry(
    "Session usage",
    "Percentage of the session quota consumed",
    "rate-limits",
    [
      v("percent", "Percent (65%)", { display: "percent" }),
      v("bar", "Bar (12 cells)", { display: "bar" }),
      v("short-bar", "Short bar (6 cells)", { display: "short-bar" }),
    ],
  ),
  "weekly-usage": entry("Weekly usage", "Percentage of the weekly quota consumed", "rate-limits", [
    v("percent", "Percent (65%)", { display: "percent" }),
    v("bar", "Bar (12 cells)", { display: "bar" }),
    v("short-bar", "Short bar (6 cells)", { display: "short-bar" }),
  ]),
  "block-timer": entry(
    "Block timer",
    "Time elapsed in the active conversation block",
    "rate-limits",
    [
      v("short", "Short (1h 23m)", { format: "short" }),
      v("long", "Long (1 hour 23 minutes)", { format: "long" }),
      v("clock", "Clock (01:23:45)", { format: "clock" }),
    ],
  ),
  "block-reset-timer": entry(
    "Block reset timer",
    "Time remaining until the next block resets",
    "rate-limits",
    [
      v("short", "Short (1h 23m)", { format: "short" }),
      v("long", "Long (1 hour 23 minutes)", { format: "long" }),
      v("clock", "Clock (01:23:45)", { format: "clock" }),
    ],
  ),
  "weekly-reset-timer": entry(
    "Weekly reset timer",
    "Time remaining until the weekly quota resets",
    "rate-limits",
    [
      v("short", "Short (3d 4h)", { format: "short" }),
      v("long", "Long (3 days 4 hours)", { format: "long" }),
      v("clock", "Clock", { format: "clock" }),
    ],
  ),
  "model-usage": entry("Usage by model", "Usage broken out by model id", "rate-limits"),
  "effort-usage": entry(
    "Usage by effort",
    "Usage broken out by thinking-effort tier",
    "rate-limits",
  ),
  "compaction-counter": entry(
    "Compaction counter",
    "Number of compactions performed in the session",
    "rate-limits",
  ),

  // Git (17)
  "git-branch": entry("Git branch", "Current branch, or short SHA when detached", "git"),
  "git-sha": entry("Git SHA", "Short commit SHA of HEAD", "git"),
  "git-worktree": entry("Git worktree", "Basename of the current worktree", "git"),
  "git-status": entry("Git status", "One-glance dirty/clean working-tree summary", "git"),
  "git-changes": entry("Git changes", "Staged, unstaged, and untracked file counts", "git"),
  "git-staged": entry("Git staged", "Staged-file count", "git"),
  "git-unstaged": entry("Git unstaged", "Unstaged-file count", "git"),
  "git-untracked": entry("Git untracked", "Untracked-file count", "git"),
  "git-insertions": entry("Git insertions", "Insertion count from git diff --shortstat", "git"),
  "git-deletions": entry("Git deletions", "Deletion count from git diff --shortstat", "git"),
  "git-conflicts": entry("Git conflicts", "Merge-conflict file count", "git"),
  "git-ahead-behind": entry("Git ahead/behind", "Commits ahead of and behind upstream", "git"),
  "git-upstream": entry("Git upstream", "Upstream branch, e.g. origin/main", "git"),
  "git-origin-owner": entry("Git origin owner", "Owner segment of the origin remote URL", "git"),
  "git-origin-repo": entry("Git origin repo", "Repo segment of the origin remote URL", "git"),
  "git-is-fork": entry(
    "Git fork marker",
    "Marker shown when upstream owner differs from origin owner",
    "git",
  ),
  "git-pr": entry(
    "Git pull request",
    "PR for HEAD's branch (opt-in network: requires options.allowNetwork)",
    "git",
    [
      v("number", "Number (#42)", { variant: "number" }),
      v("url", "URL (https://…/pull/42)", { variant: "url" }),
      v("title", "Title (feat: …)", { variant: "title" }),
      v("number-title", "Number + title (#42 feat: …)", { variant: "number-title" }),
    ],
  ),

  // Time (3)
  clock: entry("Clock", "Wall-clock time; options.format accepts strftime", "time", [
    v("time-24h", "24-hour (14:30)", { format: "%H:%M" }),
    v("time-12h", "12-hour (2:30PM)", { format: "%I:%M%p" }),
    v("seconds", "With seconds (14:30:45)", { format: "%H:%M:%S" }),
    v("date", "Date (2026-05-13)", { format: "%Y-%m-%d" }),
    v("datetime", "Date + time (2026-05-13 14:30)", { format: "%Y-%m-%d %H:%M" }),
  ]),
  "uptime-session": entry(
    "Session uptime",
    "Uptime since the Claude Code session started",
    "time",
    [
      v("short", "Short (1h 23m)", { format: "short" }),
      v("long", "Long (1 hour 23 minutes)", { format: "long" }),
      v("clock", "Clock (01:23:45)", { format: "clock" }),
    ],
  ),
  "uptime-block": entry("Block uptime", "Uptime of the active conversation block", "time", [
    v("short", "Short (1h 23m)", { format: "short" }),
    v("long", "Long (1 hour 23 minutes)", { format: "long" }),
    v("clock", "Clock (01:23:45)", { format: "clock" }),
  ]),

  // Layout / custom (4)
  separator: entry("Separator", "A single user-defined glyph (options.char)", "custom"),
  "flex-separator": entry(
    "Flex separator",
    "Absorbs remaining space on the line; dropped in Powerline mode",
    "custom",
  ),
  command: entry("Command", "Output of options.cmd run in a sandboxed shell", "custom"),
  "key-hints": entry(
    "Key hints",
    "Rotating Claude Code REPL keyboard-shortcut hint",
    "custom",
  ),
});

/** Look up a widget's metadata by `type`. */
export function widgetMeta(type: string): WidgetMeta | undefined {
  return WIDGET_CATALOG[type];
}

/** Variants for `type`, or an empty list when the widget has no variants. */
export function widgetVariants(type: string): readonly WidgetVariant[] {
  return WIDGET_CATALOG[type]?.variants ?? [];
}

/**
 * Best-guess "which variant am I currently on?" given the widget's `options`.
 * Match is by full-equality on every key the variant declares; partial matches
 * (variant declares `{display:"bar"}`, current options is
 * `{display:"bar", barWidth:8}`) still match. Returns `null` when no variant
 * fits — e.g. options has been hand-edited away from any catalogued shape.
 */
export function activeVariantId(
  type: string,
  options: Readonly<Record<string, unknown>> | undefined,
): string | null {
  const variants = widgetVariants(type);
  if (variants.length === 0) return null;
  const opts = options ?? {};
  for (const variant of variants) {
    let match = true;
    for (const [key, value] of Object.entries(variant.options)) {
      if ((opts as Record<string, unknown>)[key] !== value) {
        match = false;
        break;
      }
    }
    if (match) return variant.id;
  }
  return null;
}
