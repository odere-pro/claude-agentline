import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import {
  STATUSLINE_TRANSLATOR_VERSION,
  adaptStatuslinePayload,
  readStdinPayload,
  StdinParseError,
} from "./index.js";

function streamFrom(text: string): NodeJS.ReadableStream {
  return Readable.from([Buffer.from(text, "utf8")]);
}

describe("readStdinPayload", () => {
  it("returns empty payload on empty stream", async () => {
    const out = await readStdinPayload(streamFrom(""));
    expect(out.raw).toEqual({});
    expect(out.truncated).toBe(false);
  });

  it("parses the Claude Code contract (snake_case keys, nested model/effort/output_style)", async () => {
    const json = JSON.stringify({
      session_id: "abc-123",
      session_name: "demo",
      transcript_path: "/tmp/t.jsonl",
      cwd: "/repo",
      model: { id: "claude-opus-4-7", display_name: "Opus 4.7" },
      effort: { level: "high" },
      output_style: { name: "default" },
      workspace: { current_dir: "/repo", project_dir: "/repo" },
      version: "2.1.142",
      extra: { keep: true },
    });
    const out = await readStdinPayload(streamFrom(json));
    expect(out.model).toBe("claude-opus-4-7");
    expect(out.sessionId).toBe("abc-123");
    expect(out.sessionName).toBe("demo");
    expect(out.transcriptPath).toBe("/tmp/t.jsonl");
    expect(out.cwd).toBe("/repo");
    expect(out.thinkingEffort).toBe("high");
    expect(out.outputStyle).toBe("default");
    expect(out.version).toBe("2.1.142");
    expect(out.raw.extra).toEqual({ keep: true });
  });

  it("throws StdinParseError on malformed JSON", async () => {
    await expect(readStdinPayload(streamFrom("{not json"))).rejects.toBeInstanceOf(StdinParseError);
  });

  it("rejects non-object payloads", async () => {
    await expect(readStdinPayload(streamFrom("[]"))).rejects.toBeInstanceOf(StdinParseError);
    await expect(readStdinPayload(streamFrom("42"))).rejects.toBeInstanceOf(StdinParseError);
  });

  it("hides model when stdin omits it", async () => {
    const out = await readStdinPayload(streamFrom("{}"));
    expect(out.model).toBeUndefined();
  });
});

describe("adaptStatuslinePayload", () => {
  it("extracts model.id from the nested object Claude Code sends", () => {
    const raw = { model: { id: "claude-opus-4-7", display_name: "Opus 4.7" } };
    const out = adaptStatuslinePayload(raw);
    expect(out.model).toBe("claude-opus-4-7");
    expect(out.raw).toBe(raw);
  });

  it("accepts a flat string model for back-compat with older docs", () => {
    const out = adaptStatuslinePayload({ model: "claude-haiku-4-5" });
    expect(out.model).toBe("claude-haiku-4-5");
  });

  it("extracts effort.level (thinking effort) from the nested object", () => {
    const out = adaptStatuslinePayload({ effort: { level: "high" } });
    expect(out.thinkingEffort).toBe("high");
  });

  it("extracts output_style.name from the nested object", () => {
    const out = adaptStatuslinePayload({ output_style: { name: "explanatory" } });
    expect(out.outputStyle).toBe("explanatory");
  });

  it("reads snake_case session_id / session_name / transcript_path", () => {
    const out = adaptStatuslinePayload({
      session_id: "s1",
      session_name: "n1",
      transcript_path: "/t",
    });
    expect(out.sessionId).toBe("s1");
    expect(out.sessionName).toBe("n1");
    expect(out.transcriptPath).toBe("/t");
  });

  it("falls back to workspace.current_dir when top-level cwd is absent", () => {
    const out = adaptStatuslinePayload({ workspace: { current_dir: "/w" } });
    expect(out.cwd).toBe("/w");
  });

  it("prefers top-level cwd over workspace.current_dir when both exist", () => {
    const out = adaptStatuslinePayload({ cwd: "/top", workspace: { current_dir: "/w" } });
    expect(out.cwd).toBe("/top");
  });

  it("honours the truncated flag", () => {
    const out = adaptStatuslinePayload({}, { truncated: true });
    expect(out.truncated).toBe(true);
  });

  it("returns undefined for known fields when the payload has unrelated shapes", () => {
    const out = adaptStatuslinePayload({ model: 7 as unknown as string });
    expect(out.model).toBeUndefined();
    expect(out.raw.model).toBe(7);
  });
});

describe("adaptStatuslinePayload — context_window block", () => {
  it("sums input + cache_read + cache_creation into usedTokens and preserves windowSize", () => {
    const out = adaptStatuslinePayload({
      context_window: {
        current_usage: {
          input_tokens: 1000,
          cache_read_input_tokens: 2000,
          cache_creation_input_tokens: 500,
        },
        context_window_size: 200_000,
        used_percentage: 1.75,
      },
    });
    expect(out.contextWindow).toEqual({
      usedTokens: 3500,
      // cache_read + cache_creation — the cached portion of the live prompt.
      cachedTokens: 2500,
      windowSize: 200_000,
      usedPercentage: 1.75,
    });
  });

  it("treats missing current_usage components as zero when at least one is present", () => {
    const out = adaptStatuslinePayload({
      context_window: { current_usage: { cache_read_input_tokens: 4000 } },
    });
    expect(out.contextWindow).toEqual({ usedTokens: 4000, cachedTokens: 4000 });
  });

  it("omits cachedTokens when the host reports no cache figures", () => {
    const out = adaptStatuslinePayload({
      context_window: { current_usage: { input_tokens: 900 }, context_window_size: 200_000 },
    });
    expect(out.contextWindow).toEqual({ usedTokens: 900, windowSize: 200_000 });
    expect(out.contextWindow?.cachedTokens).toBeUndefined();
  });

  it("returns usedPercentage alone when current_usage is absent", () => {
    const out = adaptStatuslinePayload({
      context_window: { used_percentage: 42 },
    });
    expect(out.contextWindow).toEqual({ usedPercentage: 42 });
    expect(out.contextWindow?.usedTokens).toBeUndefined();
  });

  it("returns undefined when context_window has no recognised fields", () => {
    const out = adaptStatuslinePayload({ context_window: {} });
    expect(out.contextWindow).toBeUndefined();
  });

  it("returns undefined when the payload has no context_window block at all", () => {
    const out = adaptStatuslinePayload({ session_id: "s" });
    expect(out.contextWindow).toBeUndefined();
  });
});

describe("adaptStatuslinePayload — rate_limits block", () => {
  it("maps five_hour / seven_day used_percentage + resets_at", () => {
    const out = adaptStatuslinePayload({
      rate_limits: {
        five_hour: { used_percentage: 22, resets_at: 1779150600 },
        seven_day: { used_percentage: 30, resets_at: 1779357600 },
      },
    });
    expect(out.rateLimits).toEqual({
      fiveHour: { usedPercentage: 22, resetsAt: 1779150600 },
      sevenDay: { usedPercentage: 30, resetsAt: 1779357600 },
    });
  });

  it("adapts a partial block (one window only, one field only)", () => {
    const out = adaptStatuslinePayload({
      rate_limits: { five_hour: { used_percentage: 0 } },
    });
    expect(out.rateLimits).toEqual({ fiveHour: { usedPercentage: 0 } });
    expect(out.rateLimits?.sevenDay).toBeUndefined();
  });

  it("returns undefined when no window carries a recognised field", () => {
    expect(adaptStatuslinePayload({ rate_limits: {} }).rateLimits).toBeUndefined();
    expect(
      adaptStatuslinePayload({ rate_limits: { five_hour: {} } }).rateLimits,
    ).toBeUndefined();
  });

  it("returns undefined when the payload has no rate_limits block at all", () => {
    expect(adaptStatuslinePayload({ session_id: "s" }).rateLimits).toBeUndefined();
  });
});

describe("adaptStatuslinePayload — translator version", () => {
  it("stamps every adapted payload with STATUSLINE_TRANSLATOR_VERSION", () => {
    expect(adaptStatuslinePayload({}).translatorVersion).toBe(STATUSLINE_TRANSLATOR_VERSION);
    expect(adaptStatuslinePayload({ session_id: "s" }).translatorVersion).toBe(
      STATUSLINE_TRANSLATOR_VERSION,
    );
  });

  it("readStdinPayload also stamps the version on the empty-stream short-circuit", async () => {
    const out = await readStdinPayload(streamFrom(""));
    expect(out.translatorVersion).toBe(STATUSLINE_TRANSLATOR_VERSION);
  });

  it("STATUSLINE_TRANSLATOR_VERSION is 6 (bumped when the worktree accessor was added)", () => {
    expect(STATUSLINE_TRANSLATOR_VERSION).toBe(6);
  });
});

describe("adaptStatuslinePayload — vim mode", () => {
  it("extracts vim.mode from the nested block the host sends, lower-cased", () => {
    const out = adaptStatuslinePayload({ vim: { mode: "NORMAL" } });
    expect(out.vimMode).toBe("normal");
  });

  it("lower-cases multi-word uppercase modes (VISUAL LINE → visual line)", () => {
    const out = adaptStatuslinePayload({ vim: { mode: "VISUAL LINE" } });
    expect(out.vimMode).toBe("visual line");
  });

  it("reads the flat vim_mode key for back-compat with older hosts", () => {
    const out = adaptStatuslinePayload({ vim_mode: "insert" });
    expect(out.vimMode).toBe("insert");
  });

  it("prefers the nested vim.mode over a stale flat vim_mode when both exist", () => {
    const out = adaptStatuslinePayload({ vim: { mode: "VISUAL" }, vim_mode: "normal" });
    expect(out.vimMode).toBe("visual");
  });

  it("omits vimMode when neither shape is present or the block is malformed", () => {
    expect(adaptStatuslinePayload({}).vimMode).toBeUndefined();
    expect(adaptStatuslinePayload({ vim: "NORMAL" }).vimMode).toBeUndefined();
    expect(adaptStatuslinePayload({ vim: { mode: "" } }).vimMode).toBeUndefined();
  });

  it("adapts a captured Claude Code version 2.1.193 payload so the vim-mode widget can render", () => {
    // Captured shape from Claude Code version 2.1.193: vim mode is nested under `vim`
    // with an uppercase value, distinct from the older flat `vim_mode` key.
    const capturedV2_1_193 = {
      session_id: "s-193",
      version: "2.1.193",
      model: { id: "claude-opus-4-8", display_name: "Opus 4.8" },
      workspace: { current_dir: "/repo", project_dir: "/repo" },
      vim: { mode: "NORMAL" },
    };
    const out = adaptStatuslinePayload(capturedV2_1_193);
    expect(out.vimMode).toBe("normal");
    expect(out.version).toBe("2.1.193");
  });
});

describe("adaptStatuslinePayload — agent / workspace / thinking fields", () => {
  it("extracts agent.name from the nested agent block", () => {
    const out = adaptStatuslinePayload({ agent: { name: "researcher" } });
    expect(out.agentName).toBe("researcher");
  });

  it("omits agentName when the agent block is absent or malformed", () => {
    expect(adaptStatuslinePayload({}).agentName).toBeUndefined();
    expect(adaptStatuslinePayload({ agent: "researcher" }).agentName).toBeUndefined();
    expect(adaptStatuslinePayload({ agent: { name: "" } }).agentName).toBeUndefined();
  });

  it("extracts workspace.project_dir (the launch dir, distinct from cwd)", () => {
    const out = adaptStatuslinePayload({
      cwd: "/repo/sub",
      workspace: { current_dir: "/repo/sub", project_dir: "/repo" },
    });
    expect(out.projectDir).toBe("/repo");
    expect(out.cwd).toBe("/repo/sub");
  });

  it("omits projectDir when workspace is absent or project_dir is not a string", () => {
    expect(adaptStatuslinePayload({}).projectDir).toBeUndefined();
    expect(adaptStatuslinePayload({ workspace: { project_dir: 42 } }).projectDir).toBeUndefined();
  });

  it("extracts workspace.added_dirs as a string array", () => {
    const out = adaptStatuslinePayload({
      workspace: { added_dirs: ["/a", "/b", ""] },
    });
    expect(out.addedDirs).toEqual(["/a", "/b"]);
  });

  it("omits addedDirs when absent, not an array, or empty", () => {
    expect(adaptStatuslinePayload({}).addedDirs).toBeUndefined();
    expect(adaptStatuslinePayload({ workspace: { added_dirs: "/a" } }).addedDirs).toBeUndefined();
    expect(adaptStatuslinePayload({ workspace: { added_dirs: [] } }).addedDirs).toBeUndefined();
  });

  it("extracts exceeds_200k_tokens only as a real boolean", () => {
    expect(adaptStatuslinePayload({ exceeds_200k_tokens: true }).exceeds200kTokens).toBe(true);
    expect(adaptStatuslinePayload({ exceeds_200k_tokens: false }).exceeds200kTokens).toBe(false);
    expect(adaptStatuslinePayload({ exceeds_200k_tokens: "true" }).exceeds200kTokens).toBeUndefined();
    expect(adaptStatuslinePayload({}).exceeds200kTokens).toBeUndefined();
  });

  it("extracts thinking.enabled only as a real boolean from the nested block", () => {
    expect(adaptStatuslinePayload({ thinking: { enabled: true } }).thinkingEnabled).toBe(true);
    expect(adaptStatuslinePayload({ thinking: { enabled: false } }).thinkingEnabled).toBe(false);
    expect(adaptStatuslinePayload({ thinking: { enabled: 1 } }).thinkingEnabled).toBeUndefined();
    expect(adaptStatuslinePayload({ thinking: "on" }).thinkingEnabled).toBeUndefined();
    expect(adaptStatuslinePayload({}).thinkingEnabled).toBeUndefined();
  });
});

describe("adaptStatuslinePayload — pr block", () => {
  it("maps a full pr block to camelCase fields, lowercasing review_state", () => {
    const out = adaptStatuslinePayload({
      pr: { number: 244, url: "https://github.com/odere-pro/agentline/pull/244", review_state: "APPROVED" },
    });
    expect(out.pr).toEqual({
      number: 244,
      url: "https://github.com/odere-pro/agentline/pull/244",
      reviewState: "approved",
    });
  });

  it("maps a partial pr block (only number)", () => {
    const out = adaptStatuslinePayload({ pr: { number: 7 } });
    expect(out.pr).toEqual({ number: 7 });
    expect(out.pr?.url).toBeUndefined();
    expect(out.pr?.reviewState).toBeUndefined();
  });

  it("returns undefined when the pr key is absent", () => {
    const out = adaptStatuslinePayload({ session_id: "s" });
    expect(out.pr).toBeUndefined();
  });

  it("returns undefined when pr is not a plain object", () => {
    expect(adaptStatuslinePayload({ pr: "bad" }).pr).toBeUndefined();
    expect(adaptStatuslinePayload({ pr: 42 }).pr).toBeUndefined();
    expect(adaptStatuslinePayload({ pr: null }).pr).toBeUndefined();
  });

  it("lowercases review_state values", () => {
    const out = adaptStatuslinePayload({ pr: { review_state: "CHANGES_REQUESTED" } });
    expect(out.pr?.reviewState).toBe("changes_requested");
  });

  it("passes through unknown review_state values lower-cased (forward-compat)", () => {
    const out = adaptStatuslinePayload({ pr: { review_state: "FUTURE_VALUE" } });
    expect(out.pr?.reviewState).toBe("future_value");
  });

  it("omits reviewState when review_state is an empty string", () => {
    const out = adaptStatuslinePayload({ pr: { review_state: "" } });
    expect(out.pr?.reviewState).toBeUndefined();
  });
});

describe("adaptStatuslinePayload — pr block integer hardening", () => {
  it("omits pr.number when the value is a float (3.7)", () => {
    // pickFiniteNumber accepts 3.7 but the stricter integer guard must reject it.
    const out = adaptStatuslinePayload({ pr: { number: 3.7, review_state: "approved" } });
    expect(out.pr?.number).toBeUndefined();
    // The block is still present because reviewState survives.
    expect(out.pr?.reviewState).toBe("approved");
  });

  it("omits pr.number when the value is zero", () => {
    const out = adaptStatuslinePayload({ pr: { number: 0, review_state: "pending" } });
    expect(out.pr?.number).toBeUndefined();
    expect(out.pr?.reviewState).toBe("pending");
  });

  it("omits pr.number when the value is negative (-5)", () => {
    const out = adaptStatuslinePayload({ pr: { number: -5 } });
    // Only number present and it is rejected → whole pr block is undefined.
    expect(out.pr).toBeUndefined();
  });

  it("omits pr.number when the value is a non-number string", () => {
    const out = adaptStatuslinePayload({ pr: { number: "x" as unknown as number } });
    expect(out.pr?.number).toBeUndefined();
  });

  it("keeps pr.number=244 as a valid finite positive integer", () => {
    const out = adaptStatuslinePayload({ pr: { number: 244 } });
    expect(out.pr?.number).toBe(244);
  });
});

describe("adaptStatuslinePayload — workspaceRepo block", () => {
  it("maps a full workspace.repo block to host/owner/name", () => {
    const out = adaptStatuslinePayload({
      workspace: {
        current_dir: "/repo",
        repo: { host: "github.com", owner: "odere-pro", name: "agentline" },
      },
    });
    expect(out.workspaceRepo).toEqual({ host: "github.com", owner: "odere-pro", name: "agentline" });
  });

  it("maps a partial workspace.repo block (only name)", () => {
    const out = adaptStatuslinePayload({ workspace: { repo: { name: "agentline" } } });
    expect(out.workspaceRepo).toEqual({ name: "agentline" });
    expect(out.workspaceRepo?.host).toBeUndefined();
    expect(out.workspaceRepo?.owner).toBeUndefined();
  });

  it("returns undefined when workspace.repo is absent", () => {
    const out = adaptStatuslinePayload({ workspace: { current_dir: "/repo" } });
    expect(out.workspaceRepo).toBeUndefined();
  });

  it("returns undefined when workspace itself is absent", () => {
    expect(adaptStatuslinePayload({ session_id: "s" }).workspaceRepo).toBeUndefined();
  });

  it("returns undefined when workspace.repo is not a plain object", () => {
    expect(adaptStatuslinePayload({ workspace: { repo: "bad" } }).workspaceRepo).toBeUndefined();
    expect(adaptStatuslinePayload({ workspace: { repo: 42 } }).workspaceRepo).toBeUndefined();
  });

  it("returns undefined when workspace.repo has no recognised fields", () => {
    expect(adaptStatuslinePayload({ workspace: { repo: {} } }).workspaceRepo).toBeUndefined();
  });
});

describe("adaptStatuslinePayload — worktree block", () => {
  it("maps the top-level worktree.name, ignoring the richer sibling fields", () => {
    const out = adaptStatuslinePayload({
      worktree: {
        name: "issue-278",
        path: "/repo/.claude/worktrees/issue-278",
        branch: "worktree-issue-278",
        original_cwd: "/repo",
        original_branch: "main",
      },
    });
    expect(out.worktree).toEqual({ name: "issue-278" });
  });

  it("prefers nested workspace.git_worktree over top-level worktree.name", () => {
    const out = adaptStatuslinePayload({
      workspace: { current_dir: "/repo", git_worktree: "from-workspace" },
      worktree: { name: "from-top-level" },
    });
    expect(out.worktree).toEqual({ name: "from-workspace" });
  });

  it("maps nested workspace.git_worktree when no top-level worktree block is sent", () => {
    const out = adaptStatuslinePayload({
      workspace: { current_dir: "/repo", git_worktree: "issue-211" },
    });
    expect(out.worktree).toEqual({ name: "issue-211" });
  });

  it("returns undefined when neither source names a worktree", () => {
    expect(adaptStatuslinePayload({ session_id: "s" }).worktree).toBeUndefined();
    expect(adaptStatuslinePayload({ workspace: { current_dir: "/repo" } }).worktree).toBeUndefined();
  });

  it("returns undefined when the top-level worktree is not a plain object", () => {
    expect(adaptStatuslinePayload({ worktree: "bad" }).worktree).toBeUndefined();
    expect(adaptStatuslinePayload({ worktree: 42 }).worktree).toBeUndefined();
    expect(adaptStatuslinePayload({ worktree: null }).worktree).toBeUndefined();
  });

  it("returns undefined when the worktree name is an empty string and no git_worktree", () => {
    expect(adaptStatuslinePayload({ worktree: { name: "" } }).worktree).toBeUndefined();
  });

  it("falls back to worktree.name when workspace.git_worktree is an empty string", () => {
    const out = adaptStatuslinePayload({
      workspace: { current_dir: "/repo", git_worktree: "" },
      worktree: { name: "issue-278" },
    });
    expect(out.worktree).toEqual({ name: "issue-278" });
  });
});

describe("adaptStatuslinePayload — cost block", () => {
  it("maps a full cost block to camelCase fields", () => {
    const out = adaptStatuslinePayload({
      cost: {
        total_cost_usd: 1.23,
        total_duration_ms: 7500,
        total_api_duration_ms: 6000,
        total_lines_added: 156,
        total_lines_removed: 23,
      },
    });
    expect(out.cost).toEqual({
      totalUsd: 1.23,
      totalDurationMs: 7500,
      apiDurationMs: 6000,
      linesAdded: 156,
      linesRemoved: 23,
    });
  });

  it("omits fields that are absent in the raw block", () => {
    const out = adaptStatuslinePayload({
      cost: { total_cost_usd: 0.05 },
    });
    expect(out.cost?.totalUsd).toBe(0.05);
    expect(out.cost?.totalDurationMs).toBeUndefined();
    expect(out.cost?.linesAdded).toBeUndefined();
  });

  it("rejects NaN and Infinity for numeric fields", () => {
    const out = adaptStatuslinePayload({
      cost: {
        total_cost_usd: NaN,
        total_duration_ms: Infinity,
        total_lines_added: -Infinity,
      },
    });
    expect(out.cost).toBeUndefined();
  });

  it("rejects string values for numeric fields", () => {
    const out = adaptStatuslinePayload({
      cost: { total_cost_usd: "1.23" },
    });
    expect(out.cost).toBeUndefined();
  });

  it("returns undefined when the cost block is absent", () => {
    const out = adaptStatuslinePayload({ session_id: "s" });
    expect(out.cost).toBeUndefined();
  });

  it("returns undefined when cost is not a plain object", () => {
    expect(adaptStatuslinePayload({ cost: "bad" }).cost).toBeUndefined();
    expect(adaptStatuslinePayload({ cost: 42 }).cost).toBeUndefined();
    expect(adaptStatuslinePayload({ cost: null }).cost).toBeUndefined();
  });
});
