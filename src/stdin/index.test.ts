import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import { adaptStatuslinePayload, readStdinPayload, StdinParseError } from "./index.js";

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
      windowSize: 200_000,
      usedPercentage: 1.75,
    });
  });

  it("treats missing current_usage components as zero when at least one is present", () => {
    const out = adaptStatuslinePayload({
      context_window: { current_usage: { cache_read_input_tokens: 4000 } },
    });
    expect(out.contextWindow).toEqual({ usedTokens: 4000 });
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
