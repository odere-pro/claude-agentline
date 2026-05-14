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

  it("parses known fields and preserves raw payload", async () => {
    const json = JSON.stringify({
      model: "claude-opus-4-7",
      sessionId: "abc-123",
      cwd: "/repo",
      extra: { keep: true },
    });
    const out = await readStdinPayload(streamFrom(json));
    expect(out.model).toBe("claude-opus-4-7");
    expect(out.sessionId).toBe("abc-123");
    expect(out.cwd).toBe("/repo");
    expect(out.raw.extra).toEqual({ keep: true });
  });

  it("throws StdinParseError on malformed JSON", async () => {
    await expect(readStdinPayload(streamFrom("{not json"))).rejects.toBeInstanceOf(StdinParseError);
  });

  it("rejects non-object payloads", async () => {
    await expect(readStdinPayload(streamFrom("[]"))).rejects.toBeInstanceOf(StdinParseError);
    await expect(readStdinPayload(streamFrom("42"))).rejects.toBeInstanceOf(StdinParseError);
  });

  it("ignores non-string typed known fields", async () => {
    const json = JSON.stringify({ model: 7 });
    const out = await readStdinPayload(streamFrom(json));
    expect(out.model).toBeUndefined();
    expect(out.raw.model).toBe(7);
  });
});

describe("adaptStatuslinePayload", () => {
  it("narrows known string fields and preserves raw", () => {
    const raw = { model: "claude-opus-4-7", sessionId: "abc", extra: 1 };
    const out = adaptStatuslinePayload(raw);
    expect(out.model).toBe("claude-opus-4-7");
    expect(out.sessionId).toBe("abc");
    expect(out.raw).toBe(raw);
    expect(out.truncated).toBe(false);
  });

  it("honours the truncated flag", () => {
    const out = adaptStatuslinePayload({}, { truncated: true });
    expect(out.truncated).toBe(true);
  });

  it("drops non-string typed known fields", () => {
    const out = adaptStatuslinePayload({ model: 7 as unknown as string });
    expect(out.model).toBeUndefined();
    expect(out.raw.model).toBe(7);
  });
});
