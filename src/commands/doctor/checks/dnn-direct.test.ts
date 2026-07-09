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
import { checkD11 } from "./d11-widget-sanity.js";
import { checkD12 } from "./d12-widget-options.js";

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

  it("includes field-path detail from a multi-line error (not truncated at line 1)", async () => {
    const multiLineError = new Error(
      "config invalid:\n  /refreshInterval: must be >= 0\n  /theme: must be string or null",
    );
    const res = await checkD03(makeCtx({ configError: multiLineError }));
    expect(res.status).toBe("fail");
    // Line 2+ detail must survive — previously truncated at split("\n")[0]
    expect(res.message).toMatch(/refreshInterval/);
    expect(res.message).not.toMatch(/^config invalid:$/);
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

describe("checkD11", () => {
  it("passes with a note when config is not loaded", async () => {
    const res = await checkD11(makeCtx({ config: null }));
    expect(res.id).toBe("D11");
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/config not loaded/);
  });

  it("passes when there are no widgets configured", async () => {
    const res = await checkD11(makeCtx({ config: makeConfig({ lines: [] }) }));
    expect(res.id).toBe("D11");
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/0 widget/);
  });

  it("passes when every widget type is known and renderable", async () => {
    const res = await checkD11(
      makeCtx({
        config: makeConfig({
          lines: [{ widgets: [{ type: "git-branch" }, { type: "session-id" }] }],
        }),
      }),
    );
    expect(res.id).toBe("D11");
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/all renderable/);
  });

  it("warns when a widget type is unknown (removed from the registry)", async () => {
    const res = await checkD11(
      makeCtx({
        config: makeConfig({
          lines: [{ widgets: [{ type: "claude-doctor" }, { type: "git-branch" }] }],
        }),
      }),
    );
    expect(res.id).toBe("D11");
    expect(res.status).toBe("warn");
    expect(res.message).toMatch(/unknown/i);
    expect(res.message).toContain("claude-doctor");
    expect(res.hint).toMatch(/agentline edit/);
  });

  it("warns when multiple unknown widget types are present", async () => {
    const res = await checkD11(
      makeCtx({
        config: makeConfig({
          lines: [
            {
              widgets: [
                { type: "claude-update" },
                { type: "context-bar" },
                { type: "git-branch" },
              ],
            },
          ],
        }),
      }),
    );
    expect(res.id).toBe("D11");
    expect(res.status).toBe("warn");
    expect(res.message).toContain("claude-update");
    expect(res.message).toContain("context-bar");
  });

  it("passes git-pr without allowNetwork — host-provided PRs render by default", async () => {
    // The host bridge (issue #244) renders host PRs without the opt-in, so a
    // git-pr lacking allowNetwork is a working config, not an inert one.
    const res = await checkD11(
      makeCtx({
        config: makeConfig({
          lines: [{ widgets: [{ type: "git-pr" }] }],
        }),
      }),
    );
    expect(res.id).toBe("D11");
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/all renderable/);
  });

  it("passes git-pr with allowNetwork: false explicitly (still renders host PRs)", async () => {
    const res = await checkD11(
      makeCtx({
        config: makeConfig({
          lines: [{ widgets: [{ type: "git-pr", options: { allowNetwork: false } }] }],
        }),
      }),
    );
    expect(res.id).toBe("D11");
    expect(res.status).toBe("pass");
  });

  it("passes when git-pr has allowNetwork: true", async () => {
    const res = await checkD11(
      makeCtx({
        config: makeConfig({
          lines: [{ widgets: [{ type: "git-pr", options: { allowNetwork: true } }] }],
        }),
      }),
    );
    expect(res.id).toBe("D11");
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/all renderable/);
  });

  it("warns only about the unknown type, not git-pr, when both are present", async () => {
    const res = await checkD11(
      makeCtx({
        config: makeConfig({
          lines: [{ widgets: [{ type: "git-untracked" }, { type: "git-pr" }] }],
        }),
      }),
    );
    expect(res.id).toBe("D11");
    expect(res.status).toBe("warn");
    expect(res.message).toContain("git-untracked");
    expect(res.message).not.toMatch(/allowNetwork/);
  });
});

describe("checkD12", () => {
  it("passes with a note when config is not loaded", async () => {
    const res = await checkD12(makeCtx({ config: null }));
    expect(res.id).toBe("D12");
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/config not loaded/);
  });

  it("passes when every widget option is recognised", async () => {
    const res = await checkD12(
      makeCtx({
        config: makeConfig({
          lines: [
            {
              widgets: [
                { type: "thinking-effort", options: { assumeUltracode: false } },
                { type: "git-pr", options: { variant: "compact" } },
              ],
            },
          ],
        }),
      }),
    );
    expect(res.id).toBe("D12");
    expect(res.status).toBe("pass");
    expect(res.message).toMatch(/recognised/);
  });

  it("warns, names the option, AND lists the valid keys for the widget (issue #295)", async () => {
    // `variant` is valid on git-pr but silently ignored on thinking-effort —
    // the exact footgun issue #295 calls out. The message must surface the
    // valid set so the user can self-correct.
    const res = await checkD12(
      makeCtx({
        config: makeConfig({
          lines: [{ widgets: [{ type: "thinking-effort", options: { variant: "ultracode" } }] }],
        }),
      }),
    );
    expect(res.id).toBe("D12");
    expect(res.status).toBe("warn");
    expect(res.message).toContain("thinking-effort");
    expect(res.message).toContain("variant");
    // The valid-key list is the datum that resolves the footgun.
    expect(res.message).toContain("assumeUltracode");
    expect(res.hint).toMatch(/edit/);
  });

  it("does not double-report the same widget/option pair", async () => {
    const res = await checkD12(
      makeCtx({
        config: makeConfig({
          lines: [
            { widgets: [{ type: "model", options: { bogus: 1 } }] },
            { widgets: [{ type: "model", options: { bogus: 2 } }] },
          ],
        }),
      }),
    );
    expect(res.status).toBe("warn");
    // One deduped entry naming the offending key on the widget.
    expect(res.message.match(/'bogus'/g)).toHaveLength(1);
    expect(res.message).toContain("model");
  });

  it("flags an out-of-range enum value too", async () => {
    const res = await checkD12(
      makeCtx({
        config: makeConfig({
          lines: [{ widgets: [{ type: "clock", options: { format: "48h" } }] }],
        }),
      }),
    );
    expect(res.status).toBe("warn");
    expect(res.message).toContain("clock");
    expect(res.message).toContain("format");
  });
});
