/**
 * One-time upgrade notice for `agentline start` (issue #295).
 *
 * `1.6.1` flips the thinking-effort `assumeUltracode` default on, so an
 * existing user who updates suddenly sees `ultracode` where they saw
 * `xhigh`. This surfaces a single what's-new + opt-out line the first time
 * `start` runs at or below that version, then stamps `lastNotifyVersion` in
 * the shared version-check cache so it never repeats.
 *
 * Off the render path — `start` is a wiring verb, not stdin→stdout render —
 * so the cache read/write here is safe: it touches only the local state
 * file (no network, gate-14 unaffected).
 */

import { EN_DICTIONARY } from "../../core/i18n/index.js";
import { isNewer } from "../../core/lib/semver/semver.js";
import {
  readVersionCheckSync,
  stampNotifyVersion,
} from "../../data/state/version-check-cache/version-check-cache.js";
import { AGENTLINE_VERSION } from "../../version.js";

/**
 * The release whose notice this is. Shown once to anyone whose stamped
 * `lastNotifyVersion` is absent or older than this.
 */
export const ULTRACODE_NOTICE_VERSION = "1.6.1";

export interface UpgradeNoticeOptions {
  /** Env for cache resolution (honours `$CLAUDE_CONFIG_DIR`). */
  readonly env?: NodeJS.ProcessEnv;
  /** Installed version to stamp; defaults to `AGENTLINE_VERSION`. */
  readonly currentVersion?: string;
  /** Sink for the notice text; defaults to `process.stdout.write`. */
  readonly write?: (text: string) => void;
}

/**
 * Show the one-time ultracode notice when the cached `lastNotifyVersion` is
 * absent or older than `ULTRACODE_NOTICE_VERSION`, then stamp it so it does
 * not repeat. Returns `true` when the notice was shown. Best-effort: a
 * cache-write failure is swallowed by `stampNotifyVersion`, so on a broken
 * state dir the notice may reappear next run rather than being wrongly
 * suppressed.
 */
export async function maybeShowUpgradeNotice(opts: UpgradeNoticeOptions = {}): Promise<boolean> {
  const env = opts.env ?? process.env;
  const currentVersion = opts.currentVersion ?? AGENTLINE_VERSION;
  const write = opts.write ?? ((text: string) => void process.stdout.write(text));

  const seen = readVersionCheckSync(env)?.lastNotifyVersion;
  const shouldShow = seen === undefined || isNewer(ULTRACODE_NOTICE_VERSION, seen);
  if (!shouldShow) return false;

  write(`\n${EN_DICTIONARY["cmd.start.ultracode-notice"]}\n`);
  await stampNotifyVersion(ULTRACODE_NOTICE_VERSION, currentVersion, env);
  return true;
}
