import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readAuthFile, resolveAuthFilePath } from "./auth-file.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "agentline-auth-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
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
