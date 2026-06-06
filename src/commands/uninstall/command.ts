/**
 * `agentline uninstall` — remove agentline from this host.
 *
 * Delegates to scripts/uninstall.sh. Flags are forwarded 1-to-1;
 * stdin/stdout/stderr are inherited.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EN_DICTIONARY } from "../../core/i18n/index.js";
import { isHelpFlag, requestHelp } from "../../core/lib/help/help.js";
import { readLastRenderSync, type CachedRender } from "../../data/state/render-cache/render-cache.js";

const HELP = EN_DICTIONARY["cmd.uninstall.help"];

export interface UninstallArgs {
  readonly purge: boolean;
  readonly dryRun: boolean;
}

export function parseUninstallArgs(rest: readonly string[]): UninstallArgs {
  let purge = false;
  let dryRun = false;
  for (const arg of rest) {
    if (arg === "--purge") purge = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else throw new Error(`agentline uninstall: unknown argument '${arg}'`);
  }
  return { purge, dryRun };
}

/**
 * Pure formatter for the "last statusline" banner shown before
 * uninstall. Returns an empty string when there is no usable cache.
 * Extracted so it can be unit-tested without spawning the uninstall
 * script.
 *
 * The cached `rendered` string is filtered through `safeAnsiForBanner`
 * so a tampered `state/last-render.json` cannot pivot the uninstall
 * banner into a vehicle for arbitrary terminal control sequences (OSC
 * 52 clipboard writes, cursor relocations, title spoofs, BEL noise).
 * Only SGR (`ESC[…m`) sequences — the colour / bold / italic / reset
 * codes the render path actually emits — are allowed through; every
 * other C0/C1/DEL byte and every non-SGR CSI/OSC sequence is dropped.
 */
export function formatLastRenderBanner(cache: CachedRender | null): string {
  if (!cache || cache.rendered.length === 0) return "";
  const safe = safeAnsiForBanner(cache.rendered);
  const trailingNewline = safe.endsWith("\n") ? "" : "\n";
  return (
    "\nLast statusline:\n" +
    safe +
    trailingNewline +
    `(cached ${cache.savedAt} — run \`agentline reset\` to restore)\n\n`
  );
}

// eslint-disable-next-line no-control-regex
const SGR_OR_NEWLINE = /\x1b\[[0-9;]*m|\n/g;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f-\x9f]/g;

/**
 * Allow only SGR escapes and literal newlines through; strip every
 * other control character (including stray ESC, BEL, CSI cursor
 * sequences, OSC payloads). Implemented as a split-at-SGR pass so the
 * SGR payloads stay byte-identical and width/colour rendering is
 * preserved exactly as the original render emitted them.
 */
function safeAnsiForBanner(text: string): string {
  let out = "";
  let cursor = 0;
  for (const match of text.matchAll(SGR_OR_NEWLINE)) {
    const before = text.slice(cursor, match.index ?? 0);
    out += before.replace(CONTROL_CHARS, "");
    out += match[0];
    cursor = (match.index ?? 0) + match[0].length;
  }
  out += text.slice(cursor).replace(CONTROL_CHARS, "");
  return out;
}

export async function runUninstallCommand(
  args: UninstallArgs,
  io: {
    readonly stdout?: NodeJS.WritableStream;
    readonly env?: NodeJS.ProcessEnv;
  } = {},
): Promise<number> {
  const out = io.stdout ?? process.stdout;
  /*
   * Show the last rendered statusline (Memento) so the user has a
   * parting view of what was on screen, and point at how to restore
   * agentline if they change their mind. Skipped on --dry-run to keep
   * its output focused on the would-be filesystem actions.
   */
  if (!args.dryRun) {
    const banner = formatLastRenderBanner(readLastRenderSync(io.env ?? process.env));
    if (banner) out.write(banner);
  }

  const script = resolveScript("uninstall.sh");
  const argv: string[] = [];
  if (args.purge) argv.push("--purge");
  if (args.dryRun) argv.push("--dry-run");

  const result = spawnSync("bash", [script, ...argv], { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function resolveScript(name: string): string {
  const cliDir = dirname(fileURLToPath(import.meta.url));
  const path = join(cliDir, "..", "scripts", name);
  if (!existsSync(path)) {
    throw new Error(
      `agentline uninstall: script not found at ${path}\n` +
        "  This command requires the agentline repository checkout.\n" +
        "  Clone https://github.com/odere-pro/claude-agentline and run from there.",
    );
  }
  return path;
}
