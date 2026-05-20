/**
 * `ThemeFactory` — the single funnel for "what does family X look like
 * in this render context?". Bundles the env-driven Unicode degradation
 * decision and the user's per-family overrides into one object, so a
 * call site that needs identities for several families resolves them
 * through one factory rather than calling `resolveFamilyIdentity` N
 * times with the same env / override args.
 *
 * Render-safe: this leaf imports only from `family-identity` and from
 * the render-reachable env helper, so it stays free of `ink` / `react`
 * / `src/tui/` (gate-19).
 */

import type { UnicodeEnvOptions } from "../../core/lib/unicode-env/unicode-env.js";
import type { FamiliesConfig } from "../../data/config/types.js";
import type { WidgetFamily } from "./catalog-types.js";
import {
  resolveFamilyIdentity,
  type FamilyIdentity,
  type ResolvedFamilyIdentity,
} from "./family-identity.js";

export interface ThemeFactory {
  /**
   * Resolved glyph + accent colour for a widget family in the factory's
   * captured env + overrides. Equivalent to calling
   * `resolveFamilyIdentity(family, env, overrides[family])` directly.
   */
  forFamily(family: WidgetFamily): ResolvedFamilyIdentity;
}

/**
 * Construct a `ThemeFactory` bound to a process-env snapshot and the
 * `config.families` override map. Either argument may be omitted: an
 * empty env means "infer Unicode capability from the live env defaults"
 * and an absent overrides map means "use the built-in floor for every
 * family".
 */
export function createThemeFactory(
  env: UnicodeEnvOptions = {},
  overrides?: FamiliesConfig,
): ThemeFactory {
  return {
    forFamily(family: WidgetFamily): ResolvedFamilyIdentity {
      return resolveFamilyIdentity(family, env, overrides?.[family]);
    },
  };
}

export type { FamilyIdentity, ResolvedFamilyIdentity };
