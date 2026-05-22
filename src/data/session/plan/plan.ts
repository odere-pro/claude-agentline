/**
 * Per-session active-plan resolver (§7.2-adjacent).
 *
 * Resolves the plan for THIS session — not the globally newest plan file,
 * which is wrong whenever several sessions / worktrees are open. The
 * session→plan link lives in the session's transcript, where each
 * `type:"attachment"` line whose `attachment.type` is `"plan_mode"` —
 * recorded by Claude Code each time plan mode is entered — carries the
 * active plan file. We take the last such (non-subagent) attachment and
 * expose its basename as the plan name plus a clickable `file://` href.
 *
 * Resolution order (read-only, bounded, never throws — the widget hides
 * on `null`):
 *   1. The session transcript's latest `plan_mode` attachment
 *      (authoritative; reuses the token resolver's cached read this tick,
 *      so no extra file read — §1.2 N3 budget).
 *   2. The persisted session→plan map (fallback for a momentarily
 *      unreadable transcript; also the durable per-session store).
 *   3. `null` — this session has no plan, so the widget hides.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { readTranscriptRecords } from "../../../core/lib/transcript/transcript.js";
import { readSessionPlanEntrySync } from "../../state/session-plan-cache/session-plan-cache.js";

export interface PlanSnapshot {
  /** Active plan name = basename of the plan file, sans `.md`. */
  readonly name: string;
  /**
   * `file://` URL of the active plan file. The `plan` widget passes it
   * through as the cell's OSC 8 `href` so the rendered name becomes a
   * clickable link that opens the plan file in OSC-8-capable terminals.
   */
  readonly href: string;
}

export interface PlanLookupSource {
  readonly env: NodeJS.ProcessEnv;
  /** The current session id (from stdin `session_id`). */
  readonly sessionId?: string;
  /** The current session's transcript path (from stdin `transcript_path`). */
  readonly transcriptPath?: string;
  /** Wall-clock for the shared transcript cache; defaults to `Date.now()`. */
  readonly now?: number;
}

/**
 * Resolve the active plan for the current session, or `null` when the
 * session has no plan (so the widget hides). Never throws.
 */
export function loadPlanSnapshot(source: PlanLookupSource): PlanSnapshot | null {
  const fromTranscript = latestPlanFromTranscript(source.transcriptPath, source.now ?? Date.now());
  if (fromTranscript) {
    const snap = snapshotForExisting(fromTranscript);
    if (snap) return snap;
  }
  const cached = readSessionPlanEntrySync(source.sessionId, source.env);
  if (cached) {
    const snap = snapshotForExisting(cached.planFilePath);
    if (snap) return snap;
  }
  return null;
}

/**
 * The plan file of the last non-subagent `plan_mode` attachment in the
 * session's transcript, or `null`. Subagent / sidechain plan attachments
 * are ignored so the top-level statusline never flips to a subagent's
 * plan.
 */
function latestPlanFromTranscript(
  transcriptPath: string | undefined,
  now: number,
): string | null {
  if (!transcriptPath) return null;
  const records = readTranscriptRecords(transcriptPath, now);
  let planFilePath: string | null = null;
  for (const record of records) {
    const attachment = record.planAttachment;
    if (attachment && !attachment.isSubAgent) planFilePath = attachment.planFilePath;
  }
  return planFilePath;
}

/** Build a snapshot only when the plan file still exists on disk. */
function snapshotForExisting(planFilePath: string): PlanSnapshot | null {
  if (!existsSync(planFilePath)) return null;
  return {
    name: path.basename(planFilePath, ".md"),
    href: pathToFileURL(planFilePath).href,
  };
}
