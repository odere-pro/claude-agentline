/**
 * D04 — All themes referenced by config are installed.
 */

import { join } from "node:path";

import { pathExists } from "../../../core/lib/fs/fs.js";
import { resolveConfigPaths } from "../../../data/config/paths/paths.js";
import type { CheckResult } from "../types.js";

import { type CheckCtx, collectReferencedThemes, ok } from "./context.js";

export async function checkD04(ctx: CheckCtx): Promise<CheckResult> {
  const title = ctx.t("cmd.doctor.d04.title");
  const wanted = collectReferencedThemes(ctx.config);
  if (wanted.length === 0) {
    return ok("D04", title, ctx.t("cmd.doctor.d04.none"));
  }
  const themesDir = join(resolveConfigPaths(ctx.env).userDir, "themes");
  const missing: string[] = [];
  for (const name of wanted) {
    const path = join(themesDir, `${name}.json`);
    if (!(await pathExists(path))) missing.push(name);
  }
  if (missing.length === 0) {
    return ok("D04", title, ctx.t("cmd.doctor.d04.ok", { themes: wanted.join(", ") }));
  }
  return {
    id: "D04",
    title,
    status: "warn",
    message: ctx.t("cmd.doctor.d04.missing", { themes: missing.join(", ") }),
    hint: ctx.t("cmd.doctor.d04.hint"),
  };
}
