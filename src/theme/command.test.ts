import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseThemesArgs, runThemesCommand } from "./command.js";

describe("parseThemesArgs", () => {
  it("defaults to action=table (swatch view)", () => {
    expect(parseThemesArgs([])).toEqual({ action: "table" });
  });

  it("--list selects machine-readable output", () => {
    expect(parseThemesArgs(["--list"])).toEqual({ action: "list" });
  });

  it("--show <name>", () => {
    expect(parseThemesArgs(["--show", "vscode-dark"])).toEqual({
      action: "show",
      name: "vscode-dark",
    });
    expect(parseThemesArgs(["--show=foo"])).toEqual({
      action: "show",
      name: "foo",
    });
  });

  it("rejects --show without a value", () => {
    expect(() => parseThemesArgs(["--show"])).toThrow(/requires a theme name/);
  });

  it("rejects unknown args", () => {
    expect(() => parseThemesArgs(["--bogus"])).toThrow(/unknown argument/);
  });

  it("--set <name>", () => {
    expect(parseThemesArgs(["--set", "vscode-dark"])).toEqual({
      action: "set",
      name: "vscode-dark",
    });
    expect(parseThemesArgs(["--set=foo"])).toEqual({ action: "set", name: "foo" });
  });

  it("--set rejects missing value", () => {
    expect(() => parseThemesArgs(["--set"])).toThrow(/requires a theme name/);
  });

  it("--scope is no longer accepted (project layer was removed; --set always writes user config)", () => {
    expect(() => parseThemesArgs(["--set", "demo", "--scope", "user"])).toThrow(
      /unknown argument/,
    );
    expect(() => parseThemesArgs(["--set=demo", "--scope=project"])).toThrow(/unknown argument/);
  });

  it("--list, --show, and --set are mutually exclusive", () => {
    expect(() => parseThemesArgs(["--list", "--show", "demo"])).toThrow(/mutually exclusive/);
    expect(() => parseThemesArgs(["--list", "--set", "demo"])).toThrow(/mutually exclusive/);
    expect(() => parseThemesArgs(["--show", "a", "--set", "b"])).toThrow(/mutually exclusive/);
  });
});

describe("runThemesCommand", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-themes-"));
    writeFileSync(
      join(tmp, "demo.json"),
      JSON.stringify({
        name: "demo",
        palette: {
          accent: "#aabbcc",
          info: "#9cdcfe",
          success: "#00ff00",
          warning: "#ffaa00",
          danger: "#ff0000",
          muted: "#888888",
          "git-clean": "#00cc00",
          "git-dirty": "#ffaa00",
          "tokens-low": "#00cc00",
          "tokens-mid": "#ffaa00",
          "tokens-high": "#ff0000",
          "bg-section": "#1e1e1e",
          "bg-emphasis": "#2d2d30",
        },
      }),
    );
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("lists themes from the builtin directory", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runThemesCommand({
      args: { action: "list" },
      env: {},
      builtinDir: tmp,
    });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("demo");
  });

  it("show prints the resolved palette", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runThemesCommand({
      args: { action: "show", name: "demo" },
      env: {},
      builtinDir: tmp,
    });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("theme: demo");
    expect(out).toContain("accent");
    expect(out).toContain("#aabbcc");
  });

  it("show fails for unknown theme name", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runThemesCommand({
      args: { action: "show", name: "nope" },
      env: {},
      builtinDir: tmp,
    });
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalled();
  });

  it("show without name returns exit 2", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runThemesCommand({
      args: { action: "show" },
      env: {},
      builtinDir: tmp,
    });
    expect(code).toBe(2);
  });

  it("table action renders a swatch row per theme", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runThemesCommand({
      args: { action: "table" },
      env: {},
      builtinDir: tmp,
    });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("demo");
  });

  it("table action emits a TTY-friendly hint to stderr", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await runThemesCommand({
      args: { action: "table" },
      env: {},
      builtinDir: tmp,
    });
    const stderrOut = stderr.mock.calls.map((c) => String(c[0])).join("");
    expect(stderrOut).toContain("agentline doctor");
  });

  it("table action fails when no themes found", async () => {
    const empty = mkdtempSync(join(tmpdir(), "agentline-themes-empty-"));
    try {
      const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "table" },
        env: { CLAUDE_CONFIG_DIR: empty },
        builtinDir: empty,
      });
      expect(code).toBe(1);
      expect(stderr).toHaveBeenCalled();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("set creates a fresh user config when none exists", async () => {
    const home = mkdtempSync(join(tmpdir(), "agentline-themes-set-"));
    try {
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "set", name: "demo" },
        env: { CLAUDE_CONFIG_DIR: home },
        builtinDir: tmp,
      });
      expect(code).toBe(0);
      const written = JSON.parse(
        readFileSync(join(home, "agentline", "config.json"), "utf8"),
      );
      expect(written).toEqual({ version: 1, theme: "demo" });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("set patches an existing user config without dropping other fields", async () => {
    const home = mkdtempSync(join(tmpdir(), "agentline-themes-patch-"));
    try {
      mkdirSync(join(home, "agentline"));
      const target = join(home, "agentline", "config.json");
      writeFileSync(
        target,
        JSON.stringify({ version: 1, theme: "old", lines: [{ widgets: [{ type: "model" }] }] }),
      );
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "set", name: "demo" },
        env: { CLAUDE_CONFIG_DIR: home },
        builtinDir: tmp,
      });
      expect(code).toBe(0);
      const written = JSON.parse(readFileSync(target, "utf8"));
      expect(written.theme).toBe("demo");
      expect(written.version).toBe(1);
      expect(written.lines).toEqual([{ widgets: [{ type: "model" }] }]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("set is idempotent", async () => {
    const home = mkdtempSync(join(tmpdir(), "agentline-themes-idem-"));
    try {
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const args = { action: "set" as const, name: "demo" };
      const ctx = {
        args,
        env: { CLAUDE_CONFIG_DIR: home },
        builtinDir: tmp,
      };
      expect(await runThemesCommand(ctx)).toBe(0);
      const target = join(home, "agentline", "config.json");
      const first = readFileSync(target, "utf8");
      expect(await runThemesCommand(ctx)).toBe(0);
      const second = readFileSync(target, "utf8");
      expect(second).toBe(first);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("set rejects an unknown theme name", async () => {
    const home = mkdtempSync(join(tmpdir(), "agentline-themes-unknown-"));
    try {
      const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "set", name: "nope" },
        env: { CLAUDE_CONFIG_DIR: home },
        builtinDir: tmp,
      });
      expect(code).toBe(1);
      expect(stderr).toHaveBeenCalled();
      expect(existsSync(join(home, "agentline", "config.json"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("set rejects path-shaped theme names", async () => {
    const home = mkdtempSync(join(tmpdir(), "agentline-themes-pathsafe-"));
    try {
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "set", name: "../../etc/passwd" },
        env: { CLAUDE_CONFIG_DIR: home },
        builtinDir: tmp,
      });
      expect(code).toBe(2);
      expect(existsSync(join(home, "agentline", "config.json"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("set refuses to overwrite an existing user config that isn't valid JSON", async () => {
    const home = mkdtempSync(join(tmpdir(), "agentline-themes-badjson-"));
    try {
      mkdirSync(join(home, "agentline"));
      const target = join(home, "agentline", "config.json");
      writeFileSync(target, "{not json");
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "set", name: "demo" },
        env: { CLAUDE_CONFIG_DIR: home },
        builtinDir: tmp,
      });
      expect(code).toBe(1);
      expect(readFileSync(target, "utf8")).toBe("{not json");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
