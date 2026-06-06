/**
 * Session-field resolver (§7.2, §7.2.1).
 *
 * Combines the Claude Code stdin payload with the auth-file snapshot
 * (when stdin omits a field) into a flat `ResolvedSessionFields`
 * record session widgets read from `ctx.session`. Resolution happens
 * once per render tick — widgets MUST NOT do filesystem I/O during
 * `render()` (§1.2 N3 budget).
 */

import { isPlainObject, pickString, pickStringArray } from "../../core/lib/object/object.js";
import type { StdinPayload } from "../../core/stdin/index.js";
import {
  readAuthFile,
  readClaudeAccountFile,
  type AuthLookupSource,
  type AuthSnapshot,
} from "./auth-file/auth-file.js";

export type { AuthSnapshot } from "./auth-file/auth-file.js";

export interface ResolvedSessionFields {
  readonly model?: string;
  readonly version?: string;
  readonly outputStyle?: string;
  readonly sessionId?: string;
  readonly sessionName?: string;
  readonly accountEmail?: string;
  readonly loginMethod?: string;
  readonly orgSlug?: string;
  readonly thinkingEffort?: string;
  readonly vimMode?: string;
  readonly skills?: readonly string[];
}

function readUserBlock(payload: StdinPayload): Record<string, unknown> | undefined {
  const value = payload.raw["user"];
  return isPlainObject(value) ? value : undefined;
}

function readOrgBlock(
  user: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!user) return undefined;
  const value = user["org"];
  return isPlainObject(value) ? value : undefined;
}

export function resolveSessionFields(
  payload: StdinPayload,
  auth: AuthSnapshot | null,
): ResolvedSessionFields {
  const user = readUserBlock(payload);
  const org = readOrgBlock(user);
  /*
   * Cross-account guard (adversarial-QA finding):
   *
   * When the host sends a `user` block it has identified the current
   * session. If that block omits `email` (or another identity field) we
   * MUST NOT substitute the auth-file value — the auth file may belong
   * to a different account (e.g. after an account switch). We prefer to
   * leave the field absent (widget hides) over displaying a wrong identity.
   *
   * The fallback is only safe when stdin sends NO `user` block at all —
   * i.e. an older Claude Code version that never surfaces identity. In
   * that case the auth file is the only signal and is used as-is.
   *
   * Note: no account/org UUID is available on either side, so we cannot
   * do a positive "same account" match. The `user` block presence is the
   * best proxy: its absence means "host did not assert identity", its
   * presence means "host did assert identity, use only what it provided".
   */
  const authFallback = user === undefined ? auth : null;
  return {
    ...(payload.model ? { model: payload.model } : {}),
    ...(payload.version ? { version: payload.version } : {}),
    ...(payload.outputStyle ? { outputStyle: payload.outputStyle } : {}),
    ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
    ...(payload.sessionName ? { sessionName: payload.sessionName } : {}),
    ...((pickString(user, "email") ?? authFallback?.email) !== undefined
      ? { accountEmail: pickString(user, "email") ?? authFallback?.email }
      : {}),
    ...((pickString(user, "authMethod") ?? authFallback?.authMethod) !== undefined
      ? { loginMethod: pickString(user, "authMethod") ?? authFallback?.authMethod }
      : {}),
    ...((pickString(org, "slug") ?? authFallback?.orgSlug) !== undefined
      ? { orgSlug: pickString(org, "slug") ?? authFallback?.orgSlug }
      : {}),
    ...(payload.thinkingEffort ? { thinkingEffort: payload.thinkingEffort } : {}),
    ...(payload.vimMode ? { vimMode: payload.vimMode } : {}),
    ...((pickStringArray(payload.raw, "skills") ?? []).length
      ? { skills: pickStringArray(payload.raw, "skills") }
      : {}),
  };
}

export function loadSessionFields(
  payload: StdinPayload,
  source: AuthLookupSource,
): ResolvedSessionFields {
  const fromStdin = resolveSessionFields(payload, null);
  const needsAuth = !fromStdin.accountEmail || !fromStdin.loginMethod || !fromStdin.orgSlug;
  if (!needsAuth) return fromStdin;
  /*
   * Layer the identity fallbacks: legacy `auth.json` wins per-field
   * (back-compat) and the host's `~/.claude.json` `oauthAccount`
   * fills the rest — the latter is the only source on current
   * installs, where `auth.json` no longer exists.
   */
  const auth = mergeAuth(readAuthFile(source), readClaudeAccountFile(source));
  return resolveSessionFields(payload, auth);
}

function mergeAuth(
  primary: AuthSnapshot | null,
  secondary: AuthSnapshot | null,
): AuthSnapshot | null {
  if (!primary) return secondary;
  if (!secondary) return primary;
  const email = primary.email ?? secondary.email;
  const authMethod = primary.authMethod ?? secondary.authMethod;
  const orgSlug = primary.orgSlug ?? secondary.orgSlug;
  return {
    ...(email !== undefined ? { email } : {}),
    ...(authMethod !== undefined ? { authMethod } : {}),
    ...(orgSlug !== undefined ? { orgSlug } : {}),
  };
}
