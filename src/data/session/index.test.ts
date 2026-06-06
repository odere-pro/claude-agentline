import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { StdinPayload } from "../../core/stdin/index.js";
import { resolveSessionFields, loadSessionFields, type AuthSnapshot } from "./index.js";

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

describe("resolveSessionFields — cross-account fallback guard", () => {
  it("(a) uses stdin email when present; auth email is ignored", () => {
    const stdin = payload({
      user: { email: "session@example.com", authMethod: "oauth", org: { slug: "session-org" } },
    });
    const auth: AuthSnapshot = { email: "stale@example.com", orgSlug: "old-org" };
    const r = resolveSessionFields(stdin, auth);
    expect(r.accountEmail).toBe("session@example.com");
    expect(r.orgSlug).toBe("session-org");
  });

  it("(b) stdin omits email but auth is same-account (user block absent) → auth email shown", () => {
    // Common case: older Claude Code that never sends a user block at all.
    const auth: AuthSnapshot = { email: "me@example.com", authMethod: "oauth", orgSlug: "my-org" };
    const r = resolveSessionFields(payload(), auth);
    expect(r.accountEmail).toBe("me@example.com");
    expect(r.loginMethod).toBe("oauth");
    expect(r.orgSlug).toBe("my-org");
  });

  it("(c) stdin sends a user block but omits email → auth email NOT used (hide over mislead)", () => {
    // Host identified the session (user block present) but didn't send email.
    // Auth disk file may be a different account — suppress it.
    const stdin = payload({ user: { authMethod: "oauth", org: { slug: "live-org" } } });
    const auth: AuthSnapshot = { email: "stale@example.com", orgSlug: "old-org" };
    const r = resolveSessionFields(stdin, auth);
    expect(r.accountEmail).toBeUndefined();
    // orgSlug from stdin user block is still used
    expect(r.orgSlug).toBe("live-org");
  });

  it("(c-minimal) stdin sends a minimal user block (only email absent) → auth email NOT used", () => {
    const stdin = payload({ user: {} });
    const auth: AuthSnapshot = { email: "stale@example.com" };
    const r = resolveSessionFields(stdin, auth);
    expect(r.accountEmail).toBeUndefined();
  });

  it("(d) no stdin user block at all → full auth fallback used for all identity fields", () => {
    const auth: AuthSnapshot = {
      email: "fallback@example.com",
      authMethod: "enterprise",
      orgSlug: "corp",
    };
    const r = resolveSessionFields(payload(), auth);
    expect(r.accountEmail).toBe("fallback@example.com");
    expect(r.loginMethod).toBe("enterprise");
    expect(r.orgSlug).toBe("corp");
  });
});

describe("loadSessionFields — identity fallbacks", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "agentline-session-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("populates accountEmail from ~/.claude.json oauthAccount when stdin and auth.json are absent", () => {
    writeFileSync(
      path.join(tmp, ".claude.json"),
      JSON.stringify({ oauthAccount: { emailAddress: "me@example.com", organizationName: "Org" } }),
    );
    const fields = loadSessionFields(payload(), { env: { CLAUDE_CONFIG_DIR: tmp } });
    expect(fields.accountEmail).toBe("me@example.com");
    expect(fields.loginMethod).toBe("oauth");
    expect(fields.orgSlug).toBe("Org");
  });

  it("prefers legacy auth.json over oauthAccount per field (back-compat)", () => {
    writeFileSync(
      path.join(tmp, "auth.json"),
      JSON.stringify({ email: "legacy@example.com", authMethod: "enterprise" }),
    );
    writeFileSync(
      path.join(tmp, ".claude.json"),
      JSON.stringify({ oauthAccount: { emailAddress: "oauth@example.com", organizationName: "Org" } }),
    );
    const fields = loadSessionFields(payload(), { env: { CLAUDE_CONFIG_DIR: tmp } });
    // auth.json wins on the fields it carries; oauthAccount fills the gap (org).
    expect(fields.accountEmail).toBe("legacy@example.com");
    expect(fields.loginMethod).toBe("enterprise");
    expect(fields.orgSlug).toBe("Org");
  });

  it("returns complete stdin identity without consulting the fallback files", () => {
    const stdin = payload({
      user: { email: "s@example.com", authMethod: "oauth", org: { slug: "s-org" } },
    });
    // No files written under tmp; a complete stdin identity must not need them.
    const fields = loadSessionFields(stdin, { env: { CLAUDE_CONFIG_DIR: tmp } });
    expect(fields).toMatchObject({
      accountEmail: "s@example.com",
      loginMethod: "oauth",
      orgSlug: "s-org",
    });
  });
});
