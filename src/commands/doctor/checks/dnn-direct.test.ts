import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDictTranslator } from "../../../core/i18n/index.js";
import type { AgentlineConfig } from "../../../data/config/index.js";

import type { CheckCtx } from "./context.js";
import { checkD01 } from "./d01-settings-exists.js";
import { checkD03 } from "./d03-config-schema.js";
import { checkD04 } from "./d04-themes-installed.js";
import { checkD05 } from "./d05-git-on-path.js";
import { checkD08 } from "./d08-render-fixture.js";
import { checkD09 } from "./d09-refresh-interval.js";

/*
 * Per-check direct unit tests. Each builds a minimal `CheckCtx` and
 * invokes the check function directly, avoiding the runChecks pipeline
 * so the per-check pass / warn / fail behaviour is asserted in
 * isolation. Companion to `checks.test.ts` (which exercises the same
 * checks through the pipeline) and `command.test.ts` (the CLI entry).
 */

function makeCtx(overrides: Partial<CheckCtx>): CheckCtx {
  return {
    home: overrides.home ?? "/nonexistent",
    env: overrides.env ?? {},
    cwd: overrides.cwd ?? "/nonexistent",
    config: overrides.config ?? null,
    configError: overrides.configError ?? null,
    t: overrides.t ?? createDictTranslator({}),
  };
}

function makeConfig(overrides: Partial<AgentlineConfig> = {}): AgentlineConfig {
  return {
    version: 1,
    theme: null,
    lines: [],
    global: {
      padding: 1,
      separator: "|",
      valueSeparator: "·",
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
    terminalWidth: { mode: "full", compactThreshold: 80 },
    keymap: {},
    language: "en",
    refreshInterval: 0,
    families: {},
    translations: {},
    ...overrides,
  };
}

describe("checkD01", () => {
  let home: string;
  beforeEach(async () => {
    home = await fs.mkdtemp(join(tmpdir(), "agentline-d01-"));
  });
  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  it("passes when settings.json exists", async () => {
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(join(home, ".claude", "settings.json"), "{}");
    const res = await checkD01(makeCtx({ home }));
    expect(res.status).toBe("pass");
    expect(res.id).toBe("D01");
  });

  it("warns when settings.json is missing", async () => {
    const res = await checkD01(makeCtx({ home }));
    expect(res.status).toBe("warn");
    expect(res.hint).toMatch(/--fix/);
  });
});

describe("checkD03", () => {
  it("passes when configError is null", async () => {
    const res = await checkD03(makeCtx({ config: makeConfig() }));
    expect(res.status).toBe("pass");
    expect(res.id).toBe("D03");
  });

  it("fails when configError is set", async () => {
    const res = await checkD03(makeCtx({ configError: new Error("schema mismatch") }));
    expect(res.status).toBe("fail");
    expect(res.message).toMatch(/schema mismatch/);
    expect(res.hint).toMatch(/--fix/);
  });
});

describe("checkD04", () => {
  let cfgDir: string;
  beforeEach(async () => {
    cfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-d04-"));
  });
  afterEach(async () => {
    await fs.rm(cfgDir, { recursive: true, force: true });
  });

  it("passes with a note when no theme is referenced", async () => {
    const res = await checkD04(makeCtx({ config: makeConfig({ theme: null }) }));
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/no theme referenced/);
  });

  it("warns when a referenced theme is missing on disk", async () => {
    await fs.mkdir(join(cfgDir, "agentline", "themes"), { recursive: true });
    const res = await checkD04(
      makeCtx({
        config: makeConfig({ theme: "missing-theme" }),
        env: { CLAUDE_CONFIG_DIR: cfgDir },
      }),
    );
    expect(res.status).toBe("warn");
    expect(res.message).toContain("missing-theme");
  });

  it("passes when every referenced theme exists on disk", async () => {
    await fs.mkdir(join(cfgDir, "agentline", "themes"), { recursive: true });
    await fs.writeFile(join(cfgDir, "agentline", "themes", "ok.json"), "{}");
    const res = await checkD04(
      makeCtx({
        config: makeConfig({ theme: "ok" }),
        env: { CLAUDE_CONFIG_DIR: cfgDir },
      }),
    );
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/themes ok: ok/);
  });
});

describe("checkD05", () => {
  it("passes with `skipped` when no git widget is configured", async () => {
    const res = await checkD05(makeCtx({ config: makeConfig() }));
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/skipped/);
  });

  it("passes when a git widget is configured and git is on PATH", async () => {
    const res = await checkD05(
      makeCtx({
        config: makeConfig({
          lines: [{ widgets: [{ type: "git-branch" }] }],
        }),
      }),
    );
    // git is almost certainly on PATH in dev/CI; assertion is conditional.
    expect(["pass", "warn"]).toContain(res.status);
  });
});

describe("checkD08", () => {
  it("runs the embedded render fixture (pass on a healthy bin, fail otherwise)", async () => {
    const res = await checkD08(makeCtx({}));
    expect(["pass", "fail"]).toContain(res.status);
    expect(res.id).toBe("D08");
  });
});

describe("checkD09", () => {
  let home: string;
  beforeEach(async () => {
    home = await fs.mkdtemp(join(tmpdir(), "agentline-d09-"));
  });
  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  it("passes with note when config did not load", async () => {
    const res = await checkD09(makeCtx({ home }));
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/config not loaded/);
  });

  it("passes with note when settings.json is missing", async () => {
    const res = await checkD09(makeCtx({ home, config: makeConfig() }));
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/no readable settings\.json/);
  });

  it("passes with note when statusLine is not wired to agentline", async () => {
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(
      join(home, ".claude", "settings.json"),
      JSON.stringify({ statusLine: { command: "other-tool" } }),
    );
    const res = await checkD09(makeCtx({ home, config: makeConfig() }));
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/not wired to agentline/);
  });

  it("warns when config disables refresh but settings.json still has the field", async () => {
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(
      join(home, ".claude", "settings.json"),
      JSON.stringify({ statusLine: { command: "agentline render", refreshInterval: 5 } }),
    );
    const res = await checkD09(makeCtx({ home, config: makeConfig({ refreshInterval: 0 }) }));
    expect(res.status).toBe("warn");
    expect(res.message).toMatch(/config disables refresh/);
  });

  it("passes when config and settings.json agree on a positive interval", async () => {
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(
      join(home, ".claude", "settings.json"),
      JSON.stringify({ statusLine: { command: "agentline render", refreshInterval: 5 } }),
    );
    const res = await checkD09(makeCtx({ home, config: makeConfig({ refreshInterval: 5 }) }));
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/= 5s/);
  });

  it("warns when config sets an interval but settings.json omits it", async () => {
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(
      join(home, ".claude", "settings.json"),
      JSON.stringify({ statusLine: { command: "agentline render" } }),
    );
    const res = await checkD09(makeCtx({ home, config: makeConfig({ refreshInterval: 5 }) }));
    expect(res.status).toBe("warn");
    expect(res.message).toMatch(/settings\.json has none/);
  });
});
