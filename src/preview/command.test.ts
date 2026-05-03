import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parsePreviewArgs, runPreviewCommand } from "./command.js";

const NO_FLAGS = { noColor: false, noUnicode: false } as const;

// Tests inject a real templateDir so the auto-fallback in resolveConfigPath
// finds the shipped template files even though import.meta.url resolves
// against `src/` rather than `dist/` during vitest runs.
const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "templates");

describe("parsePreviewArgs", () => {
  it("zero args → single mode, default config, no theme", () => {
    expect(parsePreviewArgs([])).toEqual({ mode: "single", accessibility: NO_FLAGS });
  });

  it("--theme <name>", () => {
    expect(parsePreviewArgs(["--theme", "vscode-dark"])).toMatchObject({
      theme: "vscode-dark",
    });
    expect(parsePreviewArgs(["--theme=vscode-dark"])).toMatchObject({
      theme: "vscode-dark",
    });
  });

  it("--all-themes", () => {
    expect(parsePreviewArgs(["--all-themes"])).toMatchObject({ mode: "all-themes" });
  });

  it("--config <path>", () => {
    expect(parsePreviewArgs(["--config", "/cfg.json"])).toMatchObject({
      configPath: "/cfg.json",
    });
  });

  it("--minimal and --default select templates", () => {
    expect(parsePreviewArgs(["--minimal"])).toMatchObject({ template: "minimal" });
    expect(parsePreviewArgs(["--default"])).toMatchObject({ template: "default" });
  });

  it("rejects --config combined with --minimal", () => {
    expect(() => parsePreviewArgs(["--config", "/c.json", "--minimal"])).toThrow(
      /mutually exclusive/,
    );
  });

  it("forwards accessibility flags", () => {
    expect(parsePreviewArgs(["--no-color"])).toMatchObject({
      accessibility: { noColor: true, noUnicode: false },
    });
    expect(parsePreviewArgs(["--ascii"])).toMatchObject({
      accessibility: { noColor: true, noUnicode: true },
    });
  });

  it("rejects unknown args and missing values", () => {
    expect(() => parsePreviewArgs(["--bogus"])).toThrow(/unknown argument/);
    expect(() => parsePreviewArgs(["--theme"])).toThrow(/requires a name/);
    expect(() => parsePreviewArgs(["--config"])).toThrow(/requires a path/);
  });
});

describe("runPreviewCommand", () => {
  let tmp: string;
  let stdoutWrites: string[];
  let stderrWrites: string[];

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-preview-"));
    stdoutWrites = [];
    stderrWrites = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      stdoutWrites.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderrWrites.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("renders the built-in sample with no flags (falls back to default template)", async () => {
    const code = await runPreviewCommand({
      args: { mode: "single", accessibility: { noColor: true, noUnicode: false } },
      env: { CLAUDE_CONFIG_DIR: tmp },
      cwd: tmp,
      templateDir: TEMPLATE_DIR,
    });
    expect(code).toBe(0);
    const out = stdoutWrites.join("");
    expect(out).toContain("Sonnet 4.6");
  });

  it("prefers the user's saved config when present", async () => {
    const userDir = join(tmp, "agentline");
    mkdirSync(userDir);
    const userConfig = join(userDir, "config.json");
    writeFileSync(
      userConfig,
      JSON.stringify({
        version: 1,
        theme: null,
        lines: [{ widgets: [{ type: "model" }] }],
        global: {
          padding: 1,
          separator: "|",
          inheritColors: false,
          bold: false,
          italic: false,
          minimalist: false,
          overrideFg: null,
          overrideBg: null,
        },
        powerline: {
          enabled: false,
          theme: null,
          caps: { start: "", end: "" },
          autoAlign: false,
          continueColors: false,
        },
        terminalWidth: { mode: "full-minus-40", compactThreshold: 60 },
        keymap: {},
      }),
    );
    const code = await runPreviewCommand({
      args: { mode: "single", accessibility: { noColor: true, noUnicode: false } },
      env: { CLAUDE_CONFIG_DIR: tmp },
      cwd: tmp,
      templateDir: TEMPLATE_DIR,
    });
    expect(code).toBe(0);
    const out = stdoutWrites.join("");
    expect(out).toContain("Sonnet 4.6");
  });

  it("renders against a supplied --config", async () => {
    const cfg = join(tmp, "cfg.json");
    writeFileSync(
      cfg,
      JSON.stringify({
        version: 1,
        theme: null,
        lines: [{ widgets: [{ type: "model" }] }],
        global: {
          padding: 1,
          separator: "|",
          inheritColors: false,
          bold: false,
          italic: false,
          minimalist: false,
          overrideFg: null,
          overrideBg: null,
        },
        powerline: {
          enabled: false,
          theme: null,
          caps: { start: "", end: "" },
          autoAlign: false,
          continueColors: false,
        },
        terminalWidth: { mode: "full-minus-40", compactThreshold: 60 },
        keymap: {},
      }),
    );
    const code = await runPreviewCommand({
      args: {
        mode: "single",
        configPath: cfg,
        accessibility: { noColor: true, noUnicode: false },
      },
      env: { CLAUDE_CONFIG_DIR: tmp },
      cwd: tmp,
    });
    expect(code).toBe(0);
    const out = stdoutWrites.join("");
    expect(out).toContain("Sonnet 4.6");
  });

  it("renders one preview per theme under --all-themes", async () => {
    const builtinDir = join(tmp, "themes");
    mkdirSync(builtinDir);
    writeFileSync(
      join(builtinDir, "alpha.json"),
      JSON.stringify({
        name: "alpha",
        palette: {
          accent: "#cc785c",
          info: "#3a86ff",
          success: "#7fb069",
          warning: "#f5b700",
          danger: "#d84545",
          muted: "#888888",
          "git-clean": "#7fb069",
          "git-dirty": "#d84545",
          "tokens-low": "#7fb069",
          "tokens-mid": "#f5b700",
          "tokens-high": "#d84545",
          "bg-section": "#222222",
          "bg-emphasis": "#333333",
        },
      }),
    );
    writeFileSync(
      join(builtinDir, "beta.json"),
      JSON.stringify({
        name: "beta",
        palette: {
          accent: "#cc785c",
          info: "#3a86ff",
          success: "#7fb069",
          warning: "#f5b700",
          danger: "#d84545",
          muted: "#888888",
          "git-clean": "#7fb069",
          "git-dirty": "#d84545",
          "tokens-low": "#7fb069",
          "tokens-mid": "#f5b700",
          "tokens-high": "#d84545",
          "bg-section": "#222222",
          "bg-emphasis": "#333333",
        },
      }),
    );
    const code = await runPreviewCommand({
      args: { mode: "all-themes", accessibility: { noColor: true, noUnicode: false } },
      env: { CLAUDE_CONFIG_DIR: tmp },
      cwd: tmp,
      builtinDir,
      templateDir: TEMPLATE_DIR,
    });
    expect(code).toBe(0);
    const out = stdoutWrites.join("");
    expect(out).toContain("alpha:");
    expect(out).toContain("beta:");
  });

  it("returns 1 when --all-themes finds nothing on the search path", async () => {
    const empty = join(tmp, "empty");
    mkdirSync(empty);
    const code = await runPreviewCommand({
      args: { mode: "all-themes", accessibility: NO_FLAGS },
      env: { CLAUDE_CONFIG_DIR: tmp },
      cwd: tmp,
      builtinDir: empty,
      templateDir: TEMPLATE_DIR,
    });
    expect(code).toBe(1);
    expect(stderrWrites.join("")).toMatch(/no themes found/);
  });

  it("throws when --theme refers to an unknown theme", async () => {
    const empty = join(tmp, "empty");
    mkdirSync(empty);
    await expect(
      runPreviewCommand({
        args: {
          mode: "single",
          theme: "no-such-theme",
          accessibility: NO_FLAGS,
        },
        env: { CLAUDE_CONFIG_DIR: tmp },
        cwd: tmp,
        builtinDir: empty,
        templateDir: TEMPLATE_DIR,
      }),
    ).rejects.toThrow(/no-such-theme/);
  });
});
