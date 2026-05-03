import { describe, expect, it } from "vitest";

import type { StdinPayload } from "../stdin/index.js";
import { resolveSessionFields, type AuthSnapshot } from "./index.js";

function payload(raw: Record<string, unknown> = {}): StdinPayload {
  return { raw, truncated: false, ...convenience(raw) };
}

function convenience(raw: Record<string, unknown>): Partial<StdinPayload> {
  const pick = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  return {
    ...(pick("model") ? { model: pick("model") } : {}),
    ...(pick("version") ? { version: pick("version") } : {}),
    ...(pick("outputStyle") ? { outputStyle: pick("outputStyle") } : {}),
    ...(pick("sessionId") ? { sessionId: pick("sessionId") } : {}),
    ...(pick("sessionName") ? { sessionName: pick("sessionName") } : {}),
    ...(pick("thinkingEffort") ? { thinkingEffort: pick("thinkingEffort") } : {}),
    ...(pick("vimMode") ? { vimMode: pick("vimMode") } : {}),
  };
}

describe("resolveSessionFields", () => {
  it("prefers stdin.user.* over auth-file fallback", () => {
    const stdin = payload({
      user: { email: "stdin@example.com", authMethod: "oauth", org: { slug: "stdin-org" } },
    });
    const auth: AuthSnapshot = {
      email: "auth@example.com",
      authMethod: "api-key",
      orgSlug: "auth-org",
    };
    expect(resolveSessionFields(stdin, auth)).toEqual({
      accountEmail: "stdin@example.com",
      loginMethod: "oauth",
      orgSlug: "stdin-org",
    });
  });

  it("uses auth-file fallback when stdin omits identity fields", () => {
    const auth: AuthSnapshot = { email: "fallback@example.com", authMethod: "enterprise" };
    expect(resolveSessionFields(payload(), auth)).toEqual({
      accountEmail: "fallback@example.com",
      loginMethod: "enterprise",
    });
  });

  it("renders skills from stdin", () => {
    const stdin = payload({ skills: ["a", "b", "c"] });
    expect(resolveSessionFields(stdin, null).skills).toEqual(["a", "b", "c"]);
  });

  it("filters non-string skill entries", () => {
    const stdin = payload({ skills: ["a", 42, "", null, "b"] });
    expect(resolveSessionFields(stdin, null).skills).toEqual(["a", "b"]);
  });

  it("emits empty resolved record when nothing is available", () => {
    expect(resolveSessionFields(payload(), null)).toEqual({});
  });

  it("respects convenience accessors on the payload", () => {
    const stdin: StdinPayload = {
      raw: { model: "claude-opus-4-7" },
      truncated: false,
      model: "claude-opus-4-7",
      thinkingEffort: "high",
    };
    const r = resolveSessionFields(stdin, null);
    expect(r.model).toBe("claude-opus-4-7");
    expect(r.thinkingEffort).toBe("high");
  });
});
