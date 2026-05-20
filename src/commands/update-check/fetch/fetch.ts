/**
 * Fetch the latest published `@agentline/cli` version from the npm
 * registry.
 *
 * This module is the only place in agentline that initiates an outbound
 * HTTP request. It is **never** imported from the render path or from
 * any module the render path transitively depends on — gate 14
 * (`no-network-render`) is the trip-wire if that invariant slips.
 *
 * Contract:
 *   - Returns `null` on any failure (no network, registry 5xx, timeout,
 *     malformed JSON, missing `version` field, unsupported response).
 *   - Never throws.
 *   - Honours a 3s timeout via `AbortController` so a hung registry
 *     can't stall an `install` / `doctor` / `edit` invocation.
 */

import { isPlainObject } from "../../../core/lib/object/object.js";

const NPM_REGISTRY_URL = "https://registry.npmjs.org/@agentline/cli/latest";
const FETCH_TIMEOUT_MS = 3000;

export interface FetchLatestVersionOptions {
  readonly timeoutMs?: number;
  readonly url?: string;
  /** Test seam — defaults to global `fetch`. */
  readonly fetchImpl?: typeof fetch;
}

export async function fetchLatestVersion(
  options: FetchLatestVersionOptions = {},
): Promise<string | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = options.url ?? NPM_REGISTRY_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      /*
       * Identify ourselves so npm support can correlate; default
       * `undici` UA is fine functionally but blends into traffic.
       */
      headers: { accept: "application/json", "user-agent": "agentline-update-check" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!isPlainObject(payload)) return null;
    const version = payload.version;
    if (typeof version !== "string" || version.trim().length === 0) return null;
    return version.trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
