import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearTranscriptCache } from "../../../core/lib/transcript/transcript.js";
import { recordSessionPlan } from "../../state/session-plan-cache/session-plan-cache.js";

import { loadPlanSnapshot } from "./plan.js";

const NOW = new Date("2026-05-22T12:00:00Z").getTime();

let tmp: string;
let plansDir: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "agentline-plan-"));
  plansDir = path.join(tmp, "plans");
  mkdirSync(plansDir);
  env = { CLAUDE_CONFIG_DIR: tmp };
  // Permit the tmp transcript path (outside the default ~/.claude root).
  vi.stubEnv("AGENTLINE_TRANSCRIPT_ROOT", tmp);
  clearTranscriptCache();
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function planFile(name: string): string {
  const file = path.join(plansDir, `${name}.md`);
  writeFileSync(file, "x");
  return file;
}

/** Write a transcript JSONL with the given lines; returns its path. */
function transcript(lines: unknown[]): string {
  const file = path.join(tmp, "transcript.jsonl");
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return file;
}

function planAttachment(planFilePath: string, opts: { slug?: string; isSubAgent?: boolean } = {}) {
  return {
    type: "attachment",
    timestamp: "2026-05-22T06:00:00Z",
    ...(opts.slug ? { slug: opts.slug } : {}),
    attachment: {
      type: "plan_mode",
      isSubAgent: opts.isSubAgent ?? false,
      planFilePath,
    },
  };
}

describe("loadPlanSnapshot — transcript-driven", () => {
  it("returns the session's plan from its latest plan_mode attachment", () => {
    const file = planFile("tender-yawning-river");
    const tx = transcript([planAttachment(file, { slug: "tender-yawning-river" })]);
    expect(loadPlanSnapshot({ env, sessionId: "s1", transcriptPath: tx, now: NOW })).toEqual({
      name: "tender-yawning-river",
      href: pathToFileURL(file).href,
    });
  });

  it("picks the LAST plan_mode attachment when a session re-plans", () => {
    const first = planFile("first-plan");
    const second = planFile("second-plan");
    const tx = transcript([
      planAttachment(first),
      { timestamp: "2026-05-22T06:30:00Z", message: { usage: { input_tokens: 5 } } },
      planAttachment(second),
    ]);
    expect(loadPlanSnapshot({ env, sessionId: "s1", transcriptPath: tx, now: NOW })?.name).toBe(
      "second-plan",
    );
  });

  it("ignores subagent plan attachments", () => {
    const top = planFile("top-plan");
    const sub = planFile("sub-plan");
    const tx = transcript([planAttachment(top), planAttachment(sub, { isSubAgent: true })]);
    expect(loadPlanSnapshot({ env, sessionId: "s1", transcriptPath: tx, now: NOW })?.name).toBe(
      "top-plan",
    );
  });

  it("hides (null) when the session never entered plan mode", () => {
    const tx = transcript([{ timestamp: "2026-05-22T06:00:00Z", message: { usage: {} } }]);
    expect(loadPlanSnapshot({ env, sessionId: "s1", transcriptPath: tx, now: NOW })).toBeNull();
  });

  it("hides (null) when the plan file was deleted from disk", () => {
    const file = path.join(plansDir, "ghost.md"); // referenced but never created
    const tx = transcript([planAttachment(file)]);
    expect(loadPlanSnapshot({ env, sessionId: "s1", transcriptPath: tx, now: NOW })).toBeNull();
  });
});

describe("loadPlanSnapshot — persisted-map fallback", () => {
  it("falls back to the recorded plan when no transcript is available", async () => {
    const file = planFile("cached-plan");
    await recordSessionPlan("s1", file, "cached-plan", { env, lockTimeoutMs: 200 });
    expect(loadPlanSnapshot({ env, sessionId: "s1", now: NOW })).toEqual({
      name: "cached-plan",
      href: pathToFileURL(file).href,
    });
  });

  it("returns null when neither transcript nor cache yields a plan", () => {
    expect(loadPlanSnapshot({ env, sessionId: "unknown", now: NOW })).toBeNull();
  });

  it("prefers the transcript over a stale cached entry", async () => {
    const cached = planFile("old-cached");
    const live = planFile("live-plan");
    await recordSessionPlan("s1", cached, "old-cached", { env, lockTimeoutMs: 200 });
    const tx = transcript([planAttachment(live)]);
    expect(loadPlanSnapshot({ env, sessionId: "s1", transcriptPath: tx, now: NOW })?.name).toBe(
      "live-plan",
    );
  });
});
