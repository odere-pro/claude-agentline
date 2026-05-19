import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readAuthFile,
  resolveAuthFilePath,
  resolveClaudeConfigDir,
  readClaudeAccountFile,
  resolveClaudeAccountFilePath,
} from "./auth-file.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "agentline-auth-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("resolveClaudeConfigDir", () => {
  it("uses CLAUDE_CONFIG_DIR when set", () => {
    expect(resolveClaudeConfigDir({ env: { CLAUDE_CONFIG_DIR: "/tmp/x" } })).toBe("/tmp/x");
  });

  it("falls back to homedir/.claude when env unset", () => {
    expect(resolveClaudeConfigDir({ env: {}, homedir: "/tmp/u" })).toBe(
      path.join("/tmp/u", ".claude"),
    );
  });

  it("ignores empty CLAUDE_CONFIG_DIR", () => {
    expect(resolveClaudeConfigDir({ env: { CLAUDE_CONFIG_DIR: "  " }, homedir: "/tmp/h" })).toBe(
      path.join("/tmp/h", ".claude"),
    );
  });
});

describe("resolveAuthFilePath", () => {
  it("uses CLAUDE_CONFIG_DIR when set", () => {
    expect(resolveAuthFilePath({ env: { CLAUDE_CONFIG_DIR: "/tmp/x" } })).toBe(
      path.join("/tmp/x", "auth.json"),
    );
  });

  it("falls back to homedir/.claude when env unset", () => {
    expect(resolveAuthFilePath({ env: {}, homedir: "/tmp/u" })).toBe(
      path.join("/tmp/u", ".claude", "auth.json"),
    );
  });

  it("ignores empty CLAUDE_CONFIG_DIR", () => {
    expect(resolveAuthFilePath({ env: { CLAUDE_CONFIG_DIR: "  " }, homedir: "/tmp/h" })).toBe(
      path.join("/tmp/h", ".claude", "auth.json"),
    );
  });
});

describe("readAuthFile", () => {
  it("returns parsed snapshot when present", () => {
    const dir = path.join(tmp, ".claude");
    mkdirSync(dir);
    writeFileSync(
      path.join(dir, "auth.json"),
      JSON.stringify({ email: "u@example.com", authMethod: "oauth", orgSlug: "acme" }),
    );
    const snap = readAuthFile({ env: { CLAUDE_CONFIG_DIR: dir } });
    expect(snap).toEqual({ email: "u@example.com", authMethod: "oauth", orgSlug: "acme" });
  });

  it("returns null when file missing — never throws", () => {
    expect(readAuthFile({ env: { CLAUDE_CONFIG_DIR: tmp } })).toBeNull();
  });

  it("returns null on invalid JSON", () => {
    writeFileSync(path.join(tmp, "auth.json"), "{not json");
    expect(readAuthFile({ env: { CLAUDE_CONFIG_DIR: tmp } })).toBeNull();
  });

  it("ignores non-object root", () => {
    writeFileSync(path.join(tmp, "auth.json"), JSON.stringify(["a", "b"]));
    expect(readAuthFile({ env: { CLAUDE_CONFIG_DIR: tmp } })).toBeNull();
  });

  it("strips non-string fields", () => {
    writeFileSync(
      path.join(tmp, "auth.json"),
      JSON.stringify({ email: 1, authMethod: "x", orgSlug: ["bad"] }),
    );
    expect(readAuthFile({ env: { CLAUDE_CONFIG_DIR: tmp } })).toEqual({ authMethod: "x" });
  });
});

describe("resolveClaudeAccountFilePath", () => {
  it("uses CLAUDE_CONFIG_DIR/.claude.json when set", () => {
    expect(resolveClaudeAccountFilePath({ env: { CLAUDE_CONFIG_DIR: "/tmp/x" } })).toBe(
      path.join("/tmp/x", ".claude.json"),
    );
  });

  it("falls back to homedir/.claude.json (a sibling of .claude, not inside it)", () => {
    expect(resolveClaudeAccountFilePath({ env: {}, homedir: "/tmp/u" })).toBe(
      path.join("/tmp/u", ".claude.json"),
    );
  });

  it("ignores empty CLAUDE_CONFIG_DIR", () => {
    expect(
      resolveClaudeAccountFilePath({ env: { CLAUDE_CONFIG_DIR: "  " }, homedir: "/tmp/h" }),
    ).toBe(path.join("/tmp/h", ".claude.json"));
  });
});

describe("readClaudeAccountFile", () => {
  it("extracts identity from oauthAccount", () => {
    writeFileSync(
      path.join(tmp, ".claude.json"),
      JSON.stringify({
        oauthAccount: {
          emailAddress: "u@example.com",
          organizationName: "Acme Inc",
          accountUuid: "ignored",
        },
        someHugeUnrelatedKey: "x".repeat(1000),
      }),
    );
    expect(readClaudeAccountFile({ env: { CLAUDE_CONFIG_DIR: tmp } })).toEqual({
      email: "u@example.com",
      authMethod: "oauth",
      orgSlug: "Acme Inc",
    });
  });

  it("returns null when the file is missing — never throws", () => {
    expect(readClaudeAccountFile({ env: {}, homedir: tmp })).toBeNull();
  });

  it("returns null on invalid JSON", () => {
    writeFileSync(path.join(tmp, ".claude.json"), "{not json");
    expect(readClaudeAccountFile({ env: { CLAUDE_CONFIG_DIR: tmp } })).toBeNull();
  });

  it("returns null when oauthAccount is absent", () => {
    writeFileSync(path.join(tmp, ".claude.json"), JSON.stringify({ projects: {} }));
    expect(readClaudeAccountFile({ env: { CLAUDE_CONFIG_DIR: tmp } })).toBeNull();
  });

  it("omits email/authMethod when emailAddress is missing or empty", () => {
    writeFileSync(
      path.join(tmp, ".claude.json"),
      JSON.stringify({ oauthAccount: { emailAddress: "", organizationName: "Acme" } }),
    );
    expect(readClaudeAccountFile({ env: { CLAUDE_CONFIG_DIR: tmp } })).toEqual({
      orgSlug: "Acme",
    });
  });
});
