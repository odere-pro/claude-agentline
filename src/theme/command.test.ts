import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  it("--scope user|project pairs with --set", () => {
    expect(parseThemesArgs(["--set", "demo", "--scope", "user"])).toEqual({
      action: "set",
      name: "demo",
      scope: "user",
    });
    expect(parseThemesArgs(["--set=demo", "--scope=project"])).toEqual({
      action: "set",
      name: "demo",
      scope: "project",
    });
  });

  it("--scope without --set is rejected", () => {
    expect(() => parseThemesArgs(["--scope", "user"])).toThrow(/only applies to --set/);
    expect(() => parseThemesArgs(["--list", "--scope", "user"])).toThrow(/only applies to --set/);
  });

  it("--scope rejects unknown value", () => {
    expect(() => parseThemesArgs(["--set", "demo", "--scope", "global"])).toThrow(/unknown scope/);
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
      cwd: "/no-such-cwd",
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
      cwd: "/no-such-cwd",
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
      cwd: "/no-such-cwd",
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
      cwd: "/no-such-cwd",
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
      cwd: "/no-such-cwd",
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
      cwd: "/no-such-cwd",
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
        cwd: "/no-such-cwd",
        builtinDir: empty,
      });
      expect(code).toBe(1);
      expect(stderr).toHaveBeenCalled();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("set creates a fresh project config when none exists", async () => {
    const project = mkdtempSync(join(tmpdir(), "agentline-themes-set-"));
    try {
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "set", name: "demo", scope: "project" },
        env: { CLAUDE_PROJECT_DIR: project, CLAUDE_CONFIG_DIR: project },
        cwd: project,
        builtinDir: tmp,
      });
      expect(code).toBe(0);
      const written = JSON.parse(readFileSync(join(project, ".agentline.json"), "utf8"));
      expect(written).toEqual({ version: 1, theme: "demo" });
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("set patches an existing config without dropping other fields", async () => {
    const project = mkdtempSync(join(tmpdir(), "agentline-themes-patch-"));
    try {
      const target = join(project, ".agentline.json");
      writeFileSync(
        target,
        JSON.stringify({ version: 1, theme: "old", lines: [{ widgets: [{ type: "model" }] }] }),
      );
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "set", name: "demo", scope: "project" },
        env: { CLAUDE_PROJECT_DIR: project, CLAUDE_CONFIG_DIR: project },
        cwd: project,
        builtinDir: tmp,
      });
      expect(code).toBe(0);
      const written = JSON.parse(readFileSync(target, "utf8"));
      expect(written.theme).toBe("demo");
      expect(written.version).toBe(1);
      expect(written.lines).toEqual([{ widgets: [{ type: "model" }] }]);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("set is idempotent", async () => {
    const project = mkdtempSync(join(tmpdir(), "agentline-themes-idem-"));
    try {
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const args = { action: "set" as const, name: "demo", scope: "project" as const };
      const ctx = {
        args,
        env: { CLAUDE_PROJECT_DIR: project, CLAUDE_CONFIG_DIR: project },
        cwd: project,
        builtinDir: tmp,
      };
      expect(await runThemesCommand(ctx)).toBe(0);
      const first = readFileSync(join(project, ".agentline.json"), "utf8");
      expect(await runThemesCommand(ctx)).toBe(0);
      const second = readFileSync(join(project, ".agentline.json"), "utf8");
      expect(second).toBe(first);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("set rejects an unknown theme name", async () => {
    const project = mkdtempSync(join(tmpdir(), "agentline-themes-unknown-"));
    try {
      const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "set", name: "nope", scope: "project" },
        env: { CLAUDE_PROJECT_DIR: project, CLAUDE_CONFIG_DIR: project },
        cwd: project,
        builtinDir: tmp,
      });
      expect(code).toBe(1);
      expect(stderr).toHaveBeenCalled();
      expect(existsSync(join(project, ".agentline.json"))).toBe(false);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("set rejects path-shaped theme names", async () => {
    const project = mkdtempSync(join(tmpdir(), "agentline-themes-pathsafe-"));
    try {
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "set", name: "../../etc/passwd", scope: "project" },
        env: { CLAUDE_PROJECT_DIR: project, CLAUDE_CONFIG_DIR: project },
        cwd: project,
        builtinDir: tmp,
      });
      expect(code).toBe(2);
      expect(existsSync(join(project, ".agentline.json"))).toBe(false);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("set refuses to overwrite an existing config that isn't valid JSON", async () => {
    const project = mkdtempSync(join(tmpdir(), "agentline-themes-badjson-"));
    try {
      const target = join(project, ".agentline.json");
      writeFileSync(target, "{not json");
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "set", name: "demo", scope: "project" },
        env: { CLAUDE_PROJECT_DIR: project, CLAUDE_CONFIG_DIR: project },
        cwd: project,
        builtinDir: tmp,
      });
      expect(code).toBe(1);
      expect(readFileSync(target, "utf8")).toBe("{not json");
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("set with no scope defaults to user when no project config exists", async () => {
    const project = mkdtempSync(join(tmpdir(), "agentline-themes-defaultscope-"));
    const userHome = mkdtempSync(join(tmpdir(), "agentline-themes-user-"));
    try {
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const code = await runThemesCommand({
        args: { action: "set", name: "demo" },
        env: { CLAUDE_PROJECT_DIR: project, CLAUDE_CONFIG_DIR: userHome },
        cwd: project,
        builtinDir: tmp,
      });
      expect(code).toBe(0);
      // Project config was never created, user config should now exist.
      expect(existsSync(join(project, ".agentline.json"))).toBe(false);
      expect(existsSync(join(userHome, "agentline", "config.json"))).toBe(true);
    } finally {
      rmSync(project, { recursive: true, force: true });
      rmSync(userHome, { recursive: true, force: true });
    }
  });
});
