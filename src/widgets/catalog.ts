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
}

/** A catalogue entry paired with the `type` it describes. */
export type WidgetMetaEntry = WidgetMeta & { readonly type: string };

function entry(
  name: string,
  description: string,
  category: WidgetCategory,
): WidgetMeta {
  return Object.freeze({ name, description, category });
}

/** Canonical metadata for every built-in widget, keyed by `type`. */
export const WIDGET_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  // Session (11)
  model: entry("Model", "Active model id (e.g. Sonnet 4.6)", "session"),
  version: entry("Version", "Claude Code version", "session"),
  "output-style": entry("Output style", "Active output style", "session"),
  "session-id": entry("Session id", "Short session id", "session"),
  "session-name": entry("Session name", "Session name, or the short id when unset", "session"),
  "account-email": entry("Account email", "Logged-in account email", "session"),
  "login-method": entry("Login method", "Auth method: oauth, api-key, or device", "session"),
  org: entry("Organisation", "Active organisation name", "session"),
  "thinking-effort": entry(
    "Thinking effort",
    "Thinking-effort tier: low, medium, or high",
    "session",
  ),
  "vim-mode": entry("Vim mode", "Current vim mode when vim keybindings are active", "session"),
  skills: entry("Skills", "Skills attached to the session", "session"),

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
  ),
  "weekly-usage": entry("Weekly usage", "Percentage of the weekly quota consumed", "rate-limits"),
  "block-timer": entry(
    "Block timer",
    "Time elapsed in the active conversation block",
    "rate-limits",
  ),
  "block-reset-timer": entry(
    "Block reset timer",
    "Time remaining until the next block resets",
    "rate-limits",
  ),
  "weekly-reset-timer": entry(
    "Weekly reset timer",
    "Time remaining until the weekly quota resets",
    "rate-limits",
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

  // Git (16)
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

  // Time (3)
  clock: entry("Clock", "Wall-clock time; options.format accepts strftime", "time"),
  "uptime-session": entry("Session uptime", "Uptime since the Claude Code session started", "time"),
  "uptime-block": entry("Block uptime", "Uptime of the active conversation block", "time"),

  // Layout / custom (3)
  separator: entry("Separator", "A single user-defined glyph (options.char)", "custom"),
  "flex-separator": entry(
    "Flex separator",
    "Absorbs remaining space on the line; dropped in Powerline mode",
    "custom",
  ),
  command: entry("Command", "Output of options.cmd run in a sandboxed shell", "custom"),
});

/** Look up a widget's metadata by `type`. */
export function widgetMeta(type: string): WidgetMeta | undefined {
  return WIDGET_CATALOG[type];
}
