/**
 * Claude-project detection + the interactive pre-flight gate
 * (Phase 4 item 17).
 *
 * `isClaudeProject(cwd)` is a pure async filesystem probe — `cwd`
 * counts as a Claude project when it contains either a `.claude/`
 * directory or a `CLAUDE.md` file. Either is sufficient: many users
 * commit `CLAUDE.md` without `.claude/`, and many in-progress
 * checkouts have `.claude/` without `CLAUDE.md`.
 *
 * `projectGate` is the shared pre-flight for `init`, `install`,
 * `reset`, and `edit`. Inside a Claude project it returns `"proceed"`
 * straight away. Outside one:
 *
 *   - if stdin is a TTY, write a one-line `[y/N]` prompt to stderr
 *     and read the user's answer. `y`/`Y` → proceed, anything else
 *     → skip with a `Skipped — not a Claude project.` line.
 *
 *   - if stdin is NOT a TTY (CI, pipeline, vitest), return `"skip"`
 *     silently so scripted runs in unrelated directories don't get
 *     accidentally wired up — but tests / pipelines that DO want
 *     the command to run can either chdir into the repo (which is
 *     itself a Claude project) or call past the gate.
 *
 * `render` deliberately does NOT call this — it's a hot-path that
 * Claude Code invokes every prompt; gating it would break the
 * statusline entirely.
 */

import { createInterface } from "node:readline";
import { join } from "node:path";

import { pathExists } from "../fs/fs.js";

/** Files / dirs whose presence under `cwd` qualify it as a Claude project. */
const CLAUDE_MARKERS = [".claude", "CLAUDE.md"] as const;

/**
 * True when `cwd` looks like a Claude project — a `.claude/` directory
 * or a `CLAUDE.md` file at the top level. Async because both checks go
 * through `pathExists` (which wraps `fs.access`).
 */
export async function isClaudeProject(cwd: string): Promise<boolean> {
  for (const marker of CLAUDE_MARKERS) {
    if (await pathExists(join(cwd, marker))) return true;
  }
  return false;
}

export interface ProjectGateInput {
  /** Working directory to probe. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /**
   * Input stream the prompt reads from. Defaults to `process.stdin`.
   * The `isTTY` field gates whether we ever emit the prompt at all.
   */
  readonly stdin?: NodeJS.ReadableStream & { readonly isTTY?: boolean };
  /** Output stream the prompt + skip message are written to. Defaults to `process.stderr`. */
  readonly stderr?: { write(chunk: string): unknown };
  /** Command name surfaced in the prompt copy ("agentline edit: …"). */
  readonly command: "init" | "install" | "reset" | "edit" | "start";
}

/**
 * `"proceed"` → caller should run normally.
 * `"skip"`    → caller should exit 0 silently; nothing was done.
 */
export type ProjectGateResult = "proceed" | "skip";

/**
 * Pre-flight gate for `init`/`install`/`reset`/`edit`/`start`. Returns
 * `"proceed"` inside a Claude project unconditionally; outside one,
 * prompts on TTYs (default `N`) and skips silently on non-TTYs.
 */
export async function projectGate(input: ProjectGateInput): Promise<ProjectGateResult> {
  const cwd = input.cwd ?? process.cwd();
  if (await isClaudeProject(cwd)) return "proceed";

  const stdin = input.stdin ?? process.stdin;
  const stderr = input.stderr ?? process.stderr;

  if (!stdin.isTTY) return "skip";

  const answer = await askYesNo(stdin, stderr, input.command);
  if (answer === "y" || answer === "Y") return "proceed";
  stderr.write("Skipped — not a Claude project.\n");
  return "skip";
}

function askYesNo(
  input: NodeJS.ReadableStream & { readonly isTTY?: boolean },
  output: { write(chunk: string): unknown },
  command: ProjectGateInput["command"],
): Promise<string> {
  const prompt =
    `agentline ${command}: this directory is not a Claude project ` +
    `(no .claude/ or CLAUDE.md). proceed? [y/N] `;
  /*
   * `readline.createInterface` needs a stream pair with the same
   * `write` shape as stdout/stderr. We pass the stderr-or-test stub
   * for both prompt echo and downstream logging.
   */
  const rl = createInterface({
    input: input as NodeJS.ReadableStream,
    output: output as unknown as NodeJS.WritableStream,
    terminal: false,
  });
  return new Promise<string>((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().charAt(0));
    });
  });
}
