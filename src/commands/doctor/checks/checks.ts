/**
 * Doctor checks D01–D09 — orchestrator. Each check has its own file
 * under `./checks/`; this module builds the shared `CheckCtx` (env,
 * home, cwd, eagerly-loaded config + loader error) and dispatches them
 * sequentially in numeric order.
 *
 * Reporting and repair are split: a check NEVER mutates the host;
 * `--fix` calls the matching `fixD0N` helper in `fix.ts` separately
 * (D01–D04 and D09 have fixers; D05–D08 are reporting-only).
 *
 * On a missing-but-expected file (e.g. no themes directory when no
 * theme is referenced) the check returns `pass` with an explanatory
 * message — there is nothing wrong with the host in that scenario.
 */

import { homedir } from "node:os";

import { createDictTranslator } from "../../../core/i18n/index.js";
import { resolveEnv } from "../../../core/lib/env/env.js";
import { loadConfig } from "../../../data/config/index.js";

import { type CheckCtx } from "./context.js";
import { checkD01 } from "./d01-settings-exists.js";
import { checkD02 } from "./d02-statusline-wired.js";
import { checkD03 } from "./d03-config-schema.js";
import { checkD04 } from "./d04-themes-installed.js";
import { checkD05 } from "./d05-git-on-path.js";
import { checkD06 } from "./d06-config-writable.js";
import { checkD07 } from "./d07-update-check.js";
import { checkD08 } from "./d08-render-fixture.js";
import { checkD09 } from "./d09-refresh-interval.js";
import type { CheckResult, RunOptions } from "../types.js";

export async function runChecks(opts: RunOptions): Promise<CheckResult[]> {
  const ctx: CheckCtx = {
    home: opts.home ?? homedir(),
    env: resolveEnv(opts),
    cwd: opts.cwd ?? process.cwd(),
    config: null,
    configError: null,
    t: createDictTranslator({}),
  };
  try {
    const loaded = await loadConfig({ env: ctx.env });
    ctx.config = loaded.config;
    ctx.t = createDictTranslator(loaded.config);
  } catch (err) {
    ctx.configError = err as Error;
  }

  return [
    await checkD01(ctx),
    await checkD02(ctx),
    await checkD03(ctx),
    await checkD04(ctx),
    await checkD05(ctx),
    await checkD06(ctx),
    await checkD07(ctx),
    await checkD08(ctx),
    await checkD09(ctx),
  ];
}
