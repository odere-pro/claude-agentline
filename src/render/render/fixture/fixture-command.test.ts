import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/defaults/defaults.js";
import { ConfigValidationError } from "../../../data/config/validate/validate.js";
import type * as ConfigLoadModule from "../../../data/config/load/load.js";
import { makeGitSnapshot } from "../../../test-helpers/index.js";
import { HelpRequestedError } from "../../../core/lib/help/help.js";
import { parseRenderArgs, runRenderCommand, RenderUsageError } from "./fixture-command.js";

/** A complete serialized `GitState` with a host-provided PR (#255). */
const HOST_PR_SNAPSHOT = makeGitSnapshot({
  pr: { number: 42, url: "https://example.test/pull/42", title: "" },
  prSource: "host",
});

/** A config whose only widget is `git-pr` (default `number` variant). */
const GIT_PR_CONFIG = { ...DEFAULT_CONFIG, lines: [{ widgets: [{ type: "git-pr" }] }] };

// Module-level mock so vitest can hoist it. Only the "invalid-config
// diagnostic" suite overrides the mock behaviour per-test; the
// existing runRenderCommand suite benefits from the passthrough default
// (calls the real implementation).
vi.mock("../../../data/config/load/load.js", async (importOriginal) => {
  const original = await importOriginal<typeof ConfigLoadModule>();
  return {
    ...original,
    loadConfig: vi.fn(original.loadConfig),
  };
});

// Lazy reference acquired once at the describe level; valid after the
// hoisted vi.mock resolves.
const loadConfigMock = async () => {
  const mod = await import("../../../data/config/load/load.js");
  return vi.mocked(mod.loadConfig);
};

const NO_FLAGS = { noColor: false, noUnicode: false } as const;

describe("parseRenderArgs", () => {
  it("zero shape on no args", () => {
    expect(parseRenderArgs([])).toEqual({ accessibility: NO_FLAGS });
  });

  it("--fixture <path>", () => {
    expect(parseRenderArgs(["--fixture", "/x.json"])).toMatchObject({ fixture: "/x.json" });
    expect(parseRenderArgs(["--fixture=/y.json"])).toMatchObject({ fixture: "/y.json" });
  });

  it("--config <path>", () => {
    expect(parseRenderArgs(["--config", "/cfg.json"])).toMatchObject({
      configPath: "/cfg.json",
    });
  });

  it("--frozen-clock <iso>", () => {
    expect(parseRenderArgs(["--frozen-clock", "2026-05-01T00:00:00Z"])).toMatchObject({
      frozenClockISO: "2026-05-01T00:00:00Z",
    });
  });

  it("--width <n>", () => {
    expect(parseRenderArgs(["--width", "120"])).toMatchObject({ width: 120 });
    expect(() => parseRenderArgs(["--width", "0"])).toThrow(/positive integer/);
    expect(() => parseRenderArgs(["--width", "abc"])).toThrow(/positive integer/);
  });

  it("--no-color sets accessibility flag", () => {
    expect(parseRenderArgs(["--no-color"])).toMatchObject({
      accessibility: { noColor: true, noUnicode: false },
    });
  });

  it("--ascii sets both noColor and noUnicode", () => {
    expect(parseRenderArgs(["--ascii"])).toMatchObject({
      accessibility: { noColor: true, noUnicode: true },
    });
  });

  it("rejects unknown args", () => {
    expect(() => parseRenderArgs(["--bogus"])).toThrow(/unknown argument/);
  });

  it("rejects flags without values", () => {
    expect(() => parseRenderArgs(["--fixture"])).toThrow(/requires a path/);
    expect(() => parseRenderArgs(["--frozen-clock"])).toThrow(/ISO timestamp/);
  });

  it("--git <path> alongside --fixture", () => {
    expect(parseRenderArgs(["--fixture", "/x.json", "--git", "/g.json"])).toMatchObject({
      fixture: "/x.json",
      git: "/g.json",
    });
    expect(parseRenderArgs(["--fixture=/x.json", "--git=/g.json"])).toMatchObject({
      git: "/g.json",
    });
  });

  it("rejects --git without --fixture", () => {
    // --git can only ever inject into a deterministic replay, never the live
    // statusline — so it requires --fixture (architect condition 1, #255).
    expect(() => parseRenderArgs(["--git", "/g.json"])).toThrow(/--git requires --fixture/);
  });

  it("rejects --git without a value", () => {
    expect(() => parseRenderArgs(["--fixture", "/x.json", "--git"])).toThrow(/requires a path/);
  });

  it("parse failures throw RenderUsageError with a bare, unprefixed reason (#273)", () => {
    // The CLI catch owns the single `agentline render:` prefix; the thrown
    // message must not carry its own, or the surfaced error stutters.
    try {
      parseRenderArgs(["--git", "/g.json"]);
      throw new Error("expected parseRenderArgs to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RenderUsageError);
      expect((err as Error).message).toBe("--git requires --fixture");
    }
  });

  it("--help body is self-contained and lists every accessibility flag (#273)", () => {
    // The shipped help must not point an npm consumer at a repo-only file
    // (`tests/` is not in package.json#files), and the Options block must
    // advertise the same flags the Usage line does.
    try {
      parseRenderArgs(["--help"]);
      throw new Error("expected HelpRequestedError");
    } catch (err) {
      if (!(err instanceof HelpRequestedError)) throw err;
      expect(err.body).not.toContain("tests/golden/README.md");
      expect(err.body).toContain("--no-unicode");
      expect(err.body).toContain("--no-colour");
    }
  });
});

describe("runRenderCommand", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-render-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("reads the fixture and replays through the renderer", async () => {
    const fixture = join(tmp, "f.json");
    writeFileSync(fixture, JSON.stringify({ model: "claude-opus-4-7" }));
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: { fixture, accessibility: { noColor: true, noUnicode: false } },
    });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("Opus 4.7");
  });

  it("returns 1 on missing fixture file", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: { fixture: "/no-such-file.json", accessibility: NO_FLAGS },
    });
    expect(code).toBe(1);
  });

  it("injects a synthetic git snapshot via args.git so git widgets render", async () => {
    const fixture = join(tmp, "stdin.json");
    writeFileSync(fixture, JSON.stringify({ model: "claude-opus-4-7" }));
    const config = join(tmp, "config.json");
    writeFileSync(config, JSON.stringify(GIT_PR_CONFIG));
    const gitFile = join(tmp, "git.json");
    writeFileSync(gitFile, JSON.stringify(HOST_PR_SNAPSHOT));
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: {
        fixture,
        configPath: config,
        git: gitFile,
        accessibility: { noColor: true, noUnicode: false },
      },
    });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("#42");
  });

  it("returns 1 on a missing git file", async () => {
    const fixture = join(tmp, "stdin.json");
    writeFileSync(fixture, JSON.stringify({ model: "claude-opus-4-7" }));
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: { fixture, git: "/no-such-git.json", accessibility: NO_FLAGS },
    });
    expect(code).toBe(1);
  });

  it("returns 1 on an invalid git fixture (fails loud)", async () => {
    const fixture = join(tmp, "stdin.json");
    writeFileSync(fixture, JSON.stringify({ model: "claude-opus-4-7" }));
    const gitFile = join(tmp, "git.json");
    writeFileSync(gitFile, JSON.stringify({ branch: "main" })); // no boolean `available`
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: { fixture, git: gitFile, accessibility: NO_FLAGS },
    });
    expect(code).toBe(1);
  });

  it("rejects git injection on the live path (defense in depth) even if args bypass the parser", async () => {
    // parseRenderArgs enforces `--git requires --fixture`, but runRenderCommand
    // is exported — a direct caller could hand-build args. Re-assert the
    // load-bearing invariant at the runtime boundary so an injected snapshot
    // can never reach the live statusline.
    const gitFile = join(tmp, "git.json");
    writeFileSync(gitFile, JSON.stringify(HOST_PR_SNAPSHOT));
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: { git: gitFile, accessibility: NO_FLAGS },
      stdin: Readable.from([Buffer.from(JSON.stringify({ model: "claude-opus-4-7" }))]),
    });
    expect(code).toBe(1);
    expect(stderr.mock.calls.map((c) => String(c[0])).join("")).toMatch(/--git requires --fixture/);
  });

  it("falls back to stdin when no fixture is supplied", async () => {
    const stdin = Readable.from([Buffer.from(JSON.stringify({ model: "claude-haiku-4-5" }))]);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: { accessibility: { noColor: true, noUnicode: false } },
      stdin,
    });
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("Haiku 4.5");
  });

  it("returns 1 on empty stdin", async () => {
    const stdin = Readable.from([]);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runRenderCommand({
      args: { accessibility: { noColor: true, noUnicode: false } },
      stdin,
    });
    expect(code).toBe(1);
  });
});

/**
 * Tests for the invalid-config stderr diagnostic in `loadLiveConfig`.
 *
 * The invariant under test:
 *   - `loadConfig` THROWS only when a config file EXISTS but is broken
 *     (invalid JSON or schema-validation failure). A missing file is the
 *     normal first-run state — `readJsonIfExists` returns `undefined` and
 *     `loadConfig` resolves normally. This means a thrown error in
 *     `loadLiveConfig` reliably indicates "user has a config and it is
 *     broken" — the exact case worth surfacing.
 *   - When a throw is caught, a single concise diagnostic must appear on
 *     STDERR (never stdout), gated the same way as `maybeEmitFirstRunHint`:
 *     suppressed for non-TTY stderr and `AGENTLINE_QUIET=1`.
 *   - The render must still produce output (exit 0 / stdout non-empty);
 *     the statusline is never blank.
 */
describe("loadLiveConfig invalid-config diagnostic", () => {
  const VALID_STDIN = Buffer.from(JSON.stringify({ model: "claude-haiku-4-5" }));
  const NO_COLOUR_FLAGS = { noColor: true, noUnicode: false } as const;

  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalIsTTY = process.stderr.isTTY;
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalIsTTY !== undefined) {
      Object.defineProperty(process.stderr, "isTTY", {
        value: originalIsTTY,
        configurable: true,
      });
    }
    delete process.env.AGENTLINE_QUIET;
    // Reset the mock back to real implementation so other suites are unaffected.
    (await loadConfigMock()).mockReset();
  });

  function setTTY(value: boolean): void {
    Object.defineProperty(process.stderr, "isTTY", { value, configurable: true });
  }

  function stderrOutput(): string {
    return stderrSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("");
  }

  it("emits a diagnostic with 'invalid JSON' reason when config has bad JSON (TTY stderr)", async () => {
    (await loadConfigMock()).mockRejectedValue(
      new Error("agentline: config.json: invalid JSON — Unexpected token"),
    );
    setTTY(true);

    const code = await runRenderCommand({
      args: { accessibility: NO_COLOUR_FLAGS },
      stdin: Readable.from([VALID_STDIN]),
    });

    expect(code).toBe(0);
    const out = stderrOutput();
    expect(out).toMatch(/agentline: config invalid \(invalid JSON/);
    expect(out).toMatch(/agentline doctor/);
  });

  it("emits a diagnostic with 'schema' reason when config fails schema validation (TTY stderr)", async () => {
    const schemaErr = new ConfigValidationError([
      {
        instancePath: "/lines",
        schemaPath: "#/lines",
        keyword: "type",
        params: {},
        message: "must be array",
      },
    ]);
    (await loadConfigMock()).mockRejectedValue(schemaErr);
    setTTY(true);

    const code = await runRenderCommand({
      args: { accessibility: NO_COLOUR_FLAGS },
      stdin: Readable.from([VALID_STDIN]),
    });

    expect(code).toBe(0);
    const out = stderrOutput();
    expect(out).toMatch(/agentline: config invalid \(schema/);
    expect(out).toMatch(/agentline doctor/);
  });

  it("suppresses the diagnostic when stderr is not a TTY", async () => {
    (await loadConfigMock()).mockRejectedValue(new Error("bad JSON"));
    setTTY(false);

    await runRenderCommand({
      args: { accessibility: NO_COLOUR_FLAGS },
      stdin: Readable.from([VALID_STDIN]),
    });

    expect(stderrOutput()).not.toMatch(/config invalid/);
  });

  it("suppresses the diagnostic when AGENTLINE_QUIET=1", async () => {
    process.env.AGENTLINE_QUIET = "1";
    (await loadConfigMock()).mockRejectedValue(new Error("bad JSON"));
    setTTY(true);

    await runRenderCommand({
      args: { accessibility: NO_COLOUR_FLAGS },
      stdin: Readable.from([VALID_STDIN]),
    });

    expect(stderrOutput()).not.toMatch(/config invalid/);
  });

  it("does NOT emit the diagnostic when config file is absent (loadConfig resolves normally)", async () => {
    // When the config file is missing, loadConfig resolves without throwing.
    // That is the normal first-run state and must never trigger the broken-config warning.
    (await loadConfigMock()).mockResolvedValue({
      config: undefined as never,
      paths: { userConfig: "/tmp/not-here.json", userDir: "/tmp" },
      sources: { user: false },
    });
    setTTY(true);

    await runRenderCommand({
      args: { accessibility: NO_COLOUR_FLAGS },
      stdin: Readable.from([VALID_STDIN]),
    });

    expect(stderrOutput()).not.toMatch(/config invalid/);
  });
});
