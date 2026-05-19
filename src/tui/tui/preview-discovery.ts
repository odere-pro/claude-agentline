/**
 * Best-effort Claude Code transcript discovery for the editor preview.
 *
 * When the editor opens before Claude Code has run the statusline there is
 * no `last-stdin.json` cache, but the user is almost always mid-session, so
 * a real transcript exists in Claude Code state. This module finds the
 * newest one under
 * `${CLAUDE_CONFIG_DIR:-~/.claude}/projects/<dir>/<sessionId>.jsonl` and
 * synthesizes the `StdinPayload` the preview pipeline needs (transcript path
 * for real token counts, cwd for real git, model id for the model widget).
 *
 * Pure failure contract: any I/O or parse error yields `null` so the caller
 * can fall through to the mock session. Sync I/O only, so the synchronous
 * `previewWidget` Ink render path stays unchanged. TUI-only — never imported
 * by the render bin (the tsup split keeps it out of `dist/cli.mjs`).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { isPlainObject } from "../../core/lib/object.js";
import type { StdinPayload } from "../../core/stdin/index.js";

/** Mirror of `readTranscript`'s read cap so we never slurp a giant file. */
const MAX_TRANSCRIPT_BYTES = 16 * 1024 * 1024;

export interface DiscoverySource {
  readonly env: NodeJS.ProcessEnv;
  /** Override for tests. Defaults to `os.homedir()`. */
  readonly homedir?: string;
}

/**
 * Resolve the Claude Code data directory the same way the auth-file
 * fallback does (`src/session/auth-file.ts`): `CLAUDE_CONFIG_DIR` when set
 * and non-empty, otherwise `~/.claude`.
 */
function resolveClaudeDir(source: DiscoverySource): string {
  const fromEnv = source.env["CLAUDE_CONFIG_DIR"];
  return fromEnv && fromEnv.trim() !== ""
    ? fromEnv
    : path.join(source.homedir ?? os.homedir(), ".claude");
}

interface Candidate {
  readonly file: string;
  readonly mtimeMs: number;
  readonly size: number;
}

/** All `*.jsonl` transcripts under `projects/`, newest first. */
function listTranscripts(projectsDir: string): Candidate[] {
  let dirs: string[];
  try {
    dirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
  const out: Candidate[] = [];
  for (const dir of dirs) {
    const projectDir = path.join(projectsDir, dir);
    let files: string[];
    try {
      files = readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      const file = path.join(projectDir, f);
      try {
        const st = statSync(file);
        if (!st.isFile()) continue;
        out.push({ file, mtimeMs: st.mtimeMs, size: st.size });
      } catch {
        /* skip unreadable entry */
      }
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

interface Extracted {
  readonly cwd?: string;
  readonly version?: string;
  readonly sessionId?: string;
  readonly model?: string;
}

function pickString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Walk the transcript once. `cwd` / `version` / `sessionId` are taken from
 * the first line that carries them; `model` from the *last* assistant line
 * that has `message.model` (the most recent model the session used — the
 * Claude Code transcript has no top-level `model`, so the token parser
 * never sees it).
 */
function extractFields(text: string): Extracted {
  let cwd: string | undefined;
  let version: string | undefined;
  let sessionId: string | undefined;
  let model: string | undefined;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isPlainObject(obj)) continue;
    cwd ??= pickString(obj, "cwd");
    version ??= pickString(obj, "version");
    sessionId ??= pickString(obj, "sessionId");
    const msg = obj["message"];
    if (isPlainObject(msg)) {
      const m = pickString(msg, "model");
      if (m) model = m;
    }
  }
  return {
    ...(cwd !== undefined ? { cwd } : {}),
    ...(version !== undefined ? { version } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(model !== undefined ? { model } : {}),
  };
}

/**
 * Find the newest readable transcript and synthesize a `StdinPayload`.
 * Returns `null` when there is no Claude Code data directory, no
 * transcripts, or none can be read into a usable payload (no recoverable
 * `cwd`).
 *
 * `model` may be absent (empty/odd transcript); the caller supplies the
 * mock default in that case so the model widget never goes blank.
 */
export function discoverLatestTranscript(
  source: DiscoverySource = { env: process.env },
): StdinPayload | null {
  const projectsDir = path.join(resolveClaudeDir(source), "projects");
  const candidates = listTranscripts(projectsDir);
  for (const c of candidates) {
    if (c.size > MAX_TRANSCRIPT_BYTES) continue;
    let text: string;
    try {
      text = readFileSync(c.file, "utf8");
    } catch {
      continue;
    }
    const fields = extractFields(text);
    if (!fields.cwd) continue;
    const stem = path.basename(c.file, ".jsonl");
    const payload: StdinPayload = {
      raw: {},
      truncated: false,
      cwd: fields.cwd,
      transcriptPath: c.file,
      sessionId: fields.sessionId ?? stem,
      ...(fields.version !== undefined ? { version: fields.version } : {}),
      ...(fields.model !== undefined ? { model: fields.model } : {}),
    };
    return payload;
  }
  return null;
}
