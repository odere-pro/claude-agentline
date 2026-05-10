/**
 * Session-field resolver (§7.2, §7.2.1).
 *
 * Combines the Claude Code stdin payload with the auth-file snapshot
 * (when stdin omits a field) into a flat `ResolvedSessionFields`
 * record session widgets read from `ctx.session`. Resolution happens
 * once per render tick — widgets MUST NOT do filesystem I/O during
 * `render()` (§1.2 N3 budget).
 */

import { pickString, pickStringArray } from "../lib/object.js";
import type { StdinPayload } from "../stdin/index.js";
import { readAuthFile, type AuthLookupSource, type AuthSnapshot } from "./auth-file.js";

export { type AuthSnapshot, readAuthFile, resolveAuthFilePath } from "./auth-file.js";

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
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function readOrgBlock(user: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!user) return undefined;
  const value = user["org"];
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function resolveSessionFields(
  payload: StdinPayload,
  auth: AuthSnapshot | null,
): ResolvedSessionFields {
  const user = readUserBlock(payload);
  const org = readOrgBlock(user);
  return {
    ...(payload.model ? { model: payload.model } : {}),
    ...(payload.version ? { version: payload.version } : {}),
    ...(payload.outputStyle ? { outputStyle: payload.outputStyle } : {}),
    ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
    ...(payload.sessionName ? { sessionName: payload.sessionName } : {}),
    ...((pickString(user, "email") ?? auth?.email) !== undefined
      ? { accountEmail: pickString(user, "email") ?? auth?.email }
      : {}),
    ...((pickString(user, "authMethod") ?? auth?.authMethod) !== undefined
      ? { loginMethod: pickString(user, "authMethod") ?? auth?.authMethod }
      : {}),
    ...((pickString(org, "slug") ?? auth?.orgSlug) !== undefined
      ? { orgSlug: pickString(org, "slug") ?? auth?.orgSlug }
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
  return resolveSessionFields(payload, readAuthFile(source));
}
