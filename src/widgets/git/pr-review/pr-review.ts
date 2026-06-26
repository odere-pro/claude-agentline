/**
 * `git-pr-review` widget.
 *
 * Renders the host-provided PR review state from `ctx.stdin.pr.reviewState`.
 * The value is already lower-cased by the stdin adapter.
 *
 * Known review states and their glyph/word mappings:
 *
 *   State                | Glyph | Word
 *   ---------------------|-------|------------------
 *   approved             |  ✓    | approved
 *   changes_requested    |  ✗    | changes requested
 *   pending              |  …    | pending
 *   draft                |  ◌    | draft
 *
 * Signal colour semantics (mirrors git-changes.ts):
 *   - `approved`          → fg from `git-clean` role, `signal: true`
 *   - `changes_requested` → fg from `git-dirty` role, `signal: true`
 *   - `pending` / `draft` → neutral; no fg, no signal
 *
 * An unknown future `reviewState` value hides the widget (forward-compat
 * narrowing — same pattern as `thinking-effort` and `vim-mode`).
 *
 * Variants (catalogue):
 *   - `glyph` (DEFAULT) — single glyph character
 *   - `word`            — human-readable word/phrase
 */

import { resolveRole } from "../../../data/theme/index.js";
import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";

type GitPrReviewVariant = "glyph" | "word";

interface Options {
  readonly variant?: GitPrReviewVariant;
  readonly label?: string;
}

// Known review states in lower-cased form (as the adapter produces them).
type KnownReviewState = "approved" | "changes_requested" | "pending" | "draft";

const KNOWN_STATES: ReadonlySet<KnownReviewState> = new Set<KnownReviewState>([
  "approved",
  "changes_requested",
  "pending",
  "draft",
]);

// Glyph map — choose clear single characters; prefer ones already used in the
// project (e.g. check/cross) where they exist, otherwise simple Unicode points.
const GLYPH_MAP: Readonly<Record<KnownReviewState, string>> = Object.freeze({
  approved: "✓",
  changes_requested: "✗",
  pending: "…",
  draft: "◌",
});

// Word map — human-readable phrases.
const WORD_MAP: Readonly<Record<KnownReviewState, string>> = Object.freeze({
  approved: "approved",
  changes_requested: "changes requested",
  pending: "pending",
  draft: "draft",
});

export const gitPrReviewWidget = defineWidget<Options>(
  "git-pr-review",
  (ctx, settings): Cell => {
    const reviewState = ctx.stdin.pr?.reviewState;
    if (!reviewState) return { text: "", hidden: true };

    // Forward-compat narrowing: an unknown future value hides rather than
    // rendering garbage — matches the thinkingEffort / vimMode policy.
    if (!KNOWN_STATES.has(reviewState as KnownReviewState)) return { text: "", hidden: true };
    const state = reviewState as KnownReviewState;

    const variant = settings.options.variant ?? "glyph";
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    const body = variant === "word" ? WORD_MAP[state] : GLYPH_MAP[state];
    const text = `${label}${body}`;

    // Semantic signal colours: approved → git-clean, changes_requested → git-dirty.
    // pending/draft are neutral — omit fg and signal entirely.
    if (state === "approved") {
      return { text, fg: resolveRole(ctx.theme, "git-clean"), signal: true };
    }
    if (state === "changes_requested") {
      return { text, fg: resolveRole(ctx.theme, "git-dirty"), signal: true };
    }
    return { text };
  },
);
