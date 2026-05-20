/**
 * D06 — The resolved global config directory is writable (or creatable).
 *
 * agentline is configured globally only; the single write target is
 * `${CLAUDE_CONFIG_DIR:-~/.config}/agentline`. This always probes that
 * resolved directory — there is no "skipped" path, because the bin
 * always has a config home regardless of whether `CLAUDE_CONFIG_DIR`
 * is set.
 *
 * `probe.message` is constructed at runtime from filesystem state and
 * stays in English here; the title and hint go through the dictionary.
 */

import { resolveConfigPaths } from "../../../data/config/paths/paths.js";
import type { CheckResult } from "../types.js";

import { type CheckCtx, ok, probeWritableDir } from "./context.js";

export async function checkD06(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d06.title");
  const { userDir } = resolveConfigPaths(ctx.env);
  const probe = await probeWritableDir(userDir);
  if (probe.ok) {
    return ok("D06", title, probe.message);
  }
  return {
    id: "D06",
    title,
    status: "warn",
    message: probe.message,
    hint: ctx.t("cmd.doctor.d06.hint"),
  };
}
