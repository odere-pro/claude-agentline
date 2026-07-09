/**
 * Body for `agentline render` (§9.1, §11.3).
 *
 *   - default        read stdin, render, exit.
 *   - --fixture <p>  read the JSON payload from disk instead.
 *   - --config <p>   pin a specific config file (golden harness).
 *   - --git <p>      inject a static `GitState` snapshot from disk so git
 *                    widgets render deterministically in a golden, with no
 *                    real `git`/`gh` (§11.3 goldens, #255). Requires
 *                    `--fixture` — it must never reach the live statusline.
 *   - --frozen-clock <iso>  inject a deterministic clock so the
 *                            same fixture renders byte-identically
 *                            on every host (§11.3 goldens).
 *   - --no-color / --no-colour / --no-unicode / --ascii
 *                    accessibility flags (§1.2 N8); honoured here.
 *
 * The render itself goes through `renderForFixture` so the golden
 * harness, doctor's D08 check, and this CLI surface share one
 * pipeline.
 */

import { promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { isHelpFlag, requestHelp } from "../../../core/lib/help/help.js";
import { loadConfig } from "../../../data/config/load/load.js";
import { resolveConfigPaths } from "../../../data/config/paths/paths.js";
import type { AgentlineConfig } from "../../../data/config/types.js";
import { ConfigValidationError } from "../../../data/config/validate/validate.js";
import { pathExists } from "../../../core/lib/fs/fs.js";
import { type PlanSnapshot } from "../../../data/session/plan/plan.js";
import { recordSessionPlan } from "../../../data/state/session-plan-cache/session-plan-cache.js";
import { saveLastRender } from "../../../data/state/render-cache/render-cache.js";
import { saveGitSnapshot } from "../../../data/state/git-snapshot-cache/git-snapshot-cache.js";
import { saveLastStdin } from "../../../data/state/stdin-cache/stdin-cache.js";
import { readStdinPayload } from "../../../core/stdin/index.js";
import { parseAccessibilityArgs, type AccessibilityFlags } from "../accessibility/accessibility.js";
import { loadLiveSnapshots } from "../context.js";
import { renderForFixture, type RenderForFixtureOptions } from "./fixture-runner.js";
import { parseGitFixture } from "./parse-git-fixture.js";
import type { GitState } from "../../../data/git/index.js";

const HELP = `agentline render — re-render a recorded stdin payload

Usage:
  agentline render [--fixture <path>] [--config <path>] [--git <path>]
                   [--frozen-clock <iso>] [--width <n>]
                   [--no-color | --no-unicode | --ascii ...]

Options:
  --fixture <path>      read JSON payload from disk instead of stdin
  --config <path>       pin a specific config file (golden harness)
  --git <path>          inject a static GitState snapshot (serialized GitState
                        JSON); requires --fixture
  --frozen-clock <iso>  inject a deterministic clock for byte-identical output
  --width <n>           force terminal width
  --no-color, --no-colour, --no-unicode, --ascii
                        accessibility flags
  -h, --help            show this message

The default invocation (no \`render\` subcommand) reads stdin directly;
this subcommand exists for replaying fixtures and goldens.
`;

/**
 * Thrown by \`parseRenderArgs\` for an argument/usage mistake — an unknown
 * flag, a flag missing its value, or \`--git\` without \`--fixture\`. Kept
 * distinct from a render-time failure so the CLI can route it to
 * \`render --help\` under a single \`agentline render:\` prefix, instead of
 * the doctor/edit hints meant for runtime errors (#273). The message is the
 * bare reason — the CLI owns the prefix, so it must not be repeated here.
 */
export class RenderUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderUsageError";
  }
}

export interface RenderCommandArgs {
  readonly fixture?: string;
  readonly configPath?: string;
  /** Path to a serialized `GitState` injected on the replay path (#255). */
  readonly git?: string;
  readonly frozenClockISO?: string;
  readonly width?: number;
  readonly accessibility: AccessibilityFlags;
}

export interface RenderCommandInput {
  readonly args: RenderCommandArgs;
  readonly stdin?: NodeJS.ReadableStream;
}

const ACCESSIBILITY_FLAGS: ReadonlySet<string> = new Set([
  "--no-color",
  "--no-colour",
  "--no-unicode",
  "--ascii",
]);

/**
 * Number of statusline rows in a rendered frame.
 *
 * `renderFromInputs` terminates the frame with a single trailing newline, so a
 * naive `split("\n").length` counts a phantom empty segment and reports N+1
 * (a three-line render logged `lineCount: 4`). Diagnostic-only — this figure
 * feeds the render-cache `meta` that backs `agentline uninstall`'s
 * "last statusline" view — but a row count that is silently wrong is exactly
 * the sort of thing an operator would trust while debugging a row-count bug.
 */
export function countRenderedLines(out: string): number {
  const body = out.endsWith("\n") ? out.slice(0, -1) : out;
  return body === "" ? 0 : body.split("\n").length;
}

export async function runRenderCommand(input: RenderCommandInput): Promise<number> {
  const { fixture } = input.args;
  // Defense in depth: parseRenderArgs enforces `--git requires --fixture` for
  // the CLI, but runRenderCommand is exported — re-assert the load-bearing
  // invariant here so an injected git snapshot can never reach the live
  // statusline, even if a direct caller hand-builds the args (#255).
  if (input.args.git !== undefined && fixture === undefined) {
    process.stderr.write("agentline render: --git requires --fixture\n");
    return 1;
  }
  let payload: string;
  if (fixture) {
    try {
      payload = await fs.readFile(fixture, "utf8");
    } catch (err) {
      process.stderr.write(
        `agentline render: unable to read fixture ${fixture}: ${(err as Error).message}\n`,
      );
      return 1;
    }
  } else {
    payload = await readAll(input.stdin ?? process.stdin);
  }
  if (!payload.trim()) {
    process.stdout.write("agentline: empty stdin\n");
    if (!fixture) {
      process.stderr.write(
        "agentline: no JSON received on stdin. run `agentline doctor` to diagnose host wiring.\n",
      );
    }
    return 1;
  }
  /*
   * First-run hint: when this is a live render (no fixture, no --config)
   * and the user has not saved a config yet, point them at `agentline
   * install` (which seeds the default template). Suppressed for non-TTY
   * stderr (so the host UI is unaffected) and when AGENTLINE_QUIET=1 is set.
   */
  if (!fixture && input.args.configPath === undefined) {
    await maybeEmitFirstRunHint();
  }
  // Optional synthetic git snapshot (#255). Parsed only on the replay path —
  // `--git` requires `--fixture` (enforced in parseRenderArgs), so `isLive`
  // is always false here and the injected snapshot can never override the
  // live loader or paint fake git into the real statusline. Read/parse
  // failures fail loud with a clean diagnostic, mirroring `--fixture` above.
  let injectedGit: GitState | undefined;
  if (input.args.git !== undefined) {
    let gitRaw: string;
    try {
      gitRaw = await fs.readFile(input.args.git, "utf8");
    } catch (err) {
      process.stderr.write(
        `agentline render: unable to read git fixture ${input.args.git}: ${(err as Error).message}\n`,
      );
      return 1;
    }
    try {
      injectedGit = parseGitFixture(gitRaw);
    } catch (err) {
      process.stderr.write(
        `agentline render: invalid git fixture ${input.args.git}: ${(err as Error).message}\n`,
      );
      return 1;
    }
  }
  const isLive = !fixture && input.args.configPath === undefined;
  const liveConfig = isLive ? await loadLiveConfig() : undefined;
  const liveSnapshots = isLive ? await loadLiveSnapshotsForRender(payload, liveConfig) : {};
  const out = await renderForFixture(payload, {
    ...(liveConfig !== undefined ? { config: liveConfig } : {}),
    ...(input.args.configPath !== undefined ? { configPath: input.args.configPath } : {}),
    ...(input.args.frozenClockISO !== undefined
      ? { frozenClockISO: input.args.frozenClockISO }
      : {}),
    ...(input.args.width !== undefined ? { width: input.args.width } : {}),
    flags: input.args.accessibility,
    ...liveSnapshots,
    // Spread last: `liveSnapshots` is always `{}` on the replay path (an
    // injected git is the only git source here), so this ordering guards
    // against future changes to `liveSnapshots` rather than an active conflict.
    ...(injectedGit !== undefined ? { git: injectedGit } : {}),
  });
  process.stdout.write(out);
  /*
   * Cache the live stdin and the rendered output. Best-effort and
   * intentionally only on the live path — fixture replays and golden
   * tests must stay deterministic. The render-cache file backs the
   * "last statusline" view in `agentline uninstall`.
   */
  if (!fixture && input.args.configPath === undefined) {
    await persistLastStdin(payload);
    await saveLastRender(out, {
      meta: {
        ...(input.args.width !== undefined ? { width: input.args.width } : {}),
        lineCount: countRenderedLines(out),
      },
    });
    if ("plan" in liveSnapshots && liveSnapshots.plan) {
      await recordSessionPlanFromRender(payload, liveSnapshots.plan);
    }
    // Persist this tick's git snapshot as last-known-good so the next
    // slow tick can fall back to it instead of flickering. Best-effort,
    // live-path only, and only for an available snapshot (it carries the
    // cwd the cache is keyed on).
    if ("git" in liveSnapshots && liveSnapshots.git?.available) {
      await saveGitSnapshot(liveSnapshots.git);
    }
  }
  return 0;
}

/**
 * Load the merged user config for the live `agentline` invocation.
 * Falls back to `undefined` (which lets `renderForFixture` use
 * `DEFAULT_CONFIG`) when loading fails — the render still produces a
 * usable line instead of bailing the whole status bar.
 *
 * When loading fails the config file EXISTS but is broken (invalid JSON
 * or schema-validation failure). A missing config file is the normal
 * first-run state and never throws. Any thrown error therefore means
 * "the user has a config file and it is broken" — worth surfacing so
 * they know their edits were ignored and `agentline doctor` can explain
 * why. The diagnostic goes to STDERR only and is suppressed for non-TTY
 * stderr and when `AGENTLINE_QUIET=1` (same gate as `maybeEmitFirstRunHint`),
 * so it never spams the host process log on every render tick.
 */
async function loadLiveConfig() {
  try {
    const loaded = await loadConfig();
    return loaded.config;
  } catch (err) {
    maybeEmitConfigInvalidHint(err);
    return undefined;
  }
}

/**
 * Emit a single concise STDERR diagnostic when the user's config file
 * exists but is broken. Suppressed for non-TTY stderr and AGENTLINE_QUIET=1
 * (matching the gate used by `maybeEmitFirstRunHint`). The message is
 * intentionally generic —
 * no paths, no raw error text that could contain absolute paths (gate-02).
 * The short reason ("invalid JSON" | "schema") is safe and helps the user
 * before they run `agentline doctor`.
 */
function maybeEmitConfigInvalidHint(err: unknown): void {
  if (!process.stderr.isTTY) return;
  if (process.env.AGENTLINE_QUIET === "1") return;
  const reason = err instanceof ConfigValidationError ? "schema" : "invalid JSON";
  process.stderr.write(
    `agentline: config invalid (${reason}, using defaults) — run \`agentline doctor\`\n`,
  );
}

/**
 * Resolve the per-render-tick snapshots (session, tokens, git) for the
 * live `agentline` invocation. The fixture / `--config` paths keep
 * snapshots undefined so goldens and replays stay deterministic; only
 * the path Claude Code reads on each tick loads them. Without this the
 * widget context arrives empty and every widget that reads `ctx.git` /
 * `ctx.tokens` / `ctx.session` hides — leaving only the stdin-only
 * widgets (model, version, clock, session-id) on the statusline.
 */
async function loadLiveSnapshotsForRender(
  rawJson: string,
  config: AgentlineConfig | undefined,
): Promise<Pick<RenderForFixtureOptions, "session" | "tokens" | "git" | "plan">> {
  let parsed;
  try {
    parsed = await readStdinPayload(Readable.from([Buffer.from(rawJson, "utf8")]));
  } catch {
    return {};
  }
  return loadLiveSnapshots(parsed, { config });
}

async function persistLastStdin(rawJson: string): Promise<void> {
  try {
    const parsed = await readStdinPayload(Readable.from([Buffer.from(rawJson, "utf8")]));
    await saveLastStdin(parsed);
  } catch {
    /*
     * Cache write is best-effort; a malformed payload here would already
     * have failed the render, and the user can't see this error.
     */
  }
}

/**
 * Record this session's active plan in the session→plan map. Best-effort
 * and live-path only, mirroring the stdin / render caches. Lets the `plan`
 * widget fall back to the stored plan when the transcript is momentarily
 * unreadable, and is the durable per-session store.
 */
async function recordSessionPlanFromRender(rawJson: string, plan: PlanSnapshot): Promise<void> {
  try {
    const parsed = await readStdinPayload(Readable.from([Buffer.from(rawJson, "utf8")]));
    await recordSessionPlan(parsed.sessionId, fileURLToPath(plan.href), plan.name);
  } catch {
    /* Best-effort — a malformed payload already failed the render. */
  }
}

/**
 * Match `arg` against `--name` (next-token form) or `--name=value`
 * (joined form). Returns `null` when the flag does not match.
 *
 * For the next-token form, the value is `rest[i + 1]` and the caller
 * should consume one extra slot (`advance: 2`); for the joined form,
 * the value is the substring after `=` and only the current slot is
 * consumed (`advance: 1`). The value is returned raw (possibly empty
 * or `"-"`-prefixed); each caller validates per-flag.
 */
function matchFlag(
  arg: string | undefined,
  rest: readonly string[],
  i: number,
  name: string,
): { value: string | undefined; advance: number } | null {
  if (!arg) return null;
  if (arg === name) return { value: rest[i + 1], advance: 2 };
  const prefix = `${name}=`;
  if (arg.startsWith(prefix)) return { value: arg.slice(prefix.length), advance: 1 };
  return null;
}

function requirePathValue(name: string, value: string | undefined, label: string): string {
  if (!value || value.startsWith("-")) {
    throw new RenderUsageError(`${name} requires ${label}`);
  }
  return value;
}

function requirePositiveInt(name: string, value: string | undefined): number {
  const parsed = value !== undefined ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new RenderUsageError(`${name} requires a positive integer`);
  }
  return parsed;
}

export function parseRenderArgs(rest: readonly string[]): RenderCommandArgs {
  let fixture: string | undefined;
  let configPath: string | undefined;
  let git: string | undefined;
  let frozenClockISO: string | undefined;
  let width: number | undefined;
  const accessibilityArgv: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (isHelpFlag(arg)) {
      // `requestHelp` throws `HelpRequestedError`; never returns.
      requestHelp(HELP);
    }

    const fixtureMatch = matchFlag(arg, rest, i, "--fixture");
    if (fixtureMatch) {
      fixture = requirePathValue("--fixture", fixtureMatch.value, "a path");
      i += fixtureMatch.advance - 1;
      continue;
    }
    const configMatch = matchFlag(arg, rest, i, "--config");
    if (configMatch) {
      configPath = requirePathValue("--config", configMatch.value, "a path");
      i += configMatch.advance - 1;
      continue;
    }
    const gitMatch = matchFlag(arg, rest, i, "--git");
    if (gitMatch) {
      git = requirePathValue("--git", gitMatch.value, "a path");
      i += gitMatch.advance - 1;
      continue;
    }
    const clockMatch = matchFlag(arg, rest, i, "--frozen-clock");
    if (clockMatch) {
      frozenClockISO = requirePathValue("--frozen-clock", clockMatch.value, "an ISO timestamp");
      i += clockMatch.advance - 1;
      continue;
    }
    const widthMatch = matchFlag(arg, rest, i, "--width");
    if (widthMatch) {
      width = requirePositiveInt("--width", widthMatch.value);
      i += widthMatch.advance - 1;
      continue;
    }

    if (arg && ACCESSIBILITY_FLAGS.has(arg)) {
      accessibilityArgv.push(arg);
    } else if (arg) {
      throw new RenderUsageError(`unknown argument '${arg}'`);
    }
  }
  // `--git` injects a snapshot into a deterministic replay only; it must
  // never reach the live statusline (where it could override a real snapshot
  // or be silently dropped), so require `--fixture` alongside it (#255).
  if (git !== undefined && fixture === undefined) {
    throw new RenderUsageError("--git requires --fixture");
  }
  const out: RenderCommandArgs = {
    accessibility: parseAccessibilityArgs(accessibilityArgv),
  };
  if (fixture !== undefined) (out as { fixture: string }).fixture = fixture;
  if (configPath !== undefined) (out as { configPath: string }).configPath = configPath;
  if (git !== undefined) (out as { git: string }).git = git;
  if (frozenClockISO !== undefined)
    (out as { frozenClockISO: string }).frozenClockISO = frozenClockISO;
  if (width !== undefined) (out as { width: number }).width = width;
  return out;
}

async function maybeEmitFirstRunHint(): Promise<void> {
  if (!process.stderr.isTTY) return;
  if (process.env.AGENTLINE_QUIET === "1") return;
  const paths = resolveConfigPaths(process.env);
  const hasUser = await pathExists(paths.userConfig);
  if (hasUser) return;
  process.stderr.write(
    "# agentline: using built-in defaults — run `agentline reset` to seed a user config (silence with AGENTLINE_QUIET=1)\n",
  );
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString("utf8");
}
