/**
 * Environment-variable layer (§4.1 layer 4).
 *
 * Variables prefixed `AGENTLINE_` map to dot-paths against the config tree:
 *   AGENTLINE_GLOBAL_PADDING=2          → { global: { padding: 2 } }
 *   AGENTLINE_POWERLINE_ENABLED=true    → { powerline: { enabled: true } }
 *   AGENTLINE_THEME=catppuccin-mocha    → { theme: "catppuccin-mocha" }
 *
 * Single underscores delimit segments. Bash forbids dots in identifiers,
 * hence the underscore syntax. Values parse as JSON when possible (so
 * true / 12 / "x" round-trip), and fall back to the raw string otherwise.
 *
 * Array indices are not supported — set arrays through user / project
 * config or flags. Env is for scalar tweaks.
 */

import { stripPrototypeKeys } from "../../../core/lib/strip-prototype-keys/strip-prototype-keys.js";

const PREFIX = "AGENTLINE_";

type Plain = Record<string, unknown>;

export function envLayer(env: NodeJS.ProcessEnv = process.env): Plain {
  const out: Plain = {};
  for (const [rawKey, rawValue] of Object.entries(env)) {
    if (!rawKey.startsWith(PREFIX) || rawValue === undefined) continue;
    const path = rawKey
      .slice(PREFIX.length)
      .split("_")
      .filter((s) => s.length > 0)
      .map((s) => s.toLowerCase());
    if (path.length === 0) continue;
    setDeep(out, path, decodeValue(rawValue));
  }
  return out;
}

function decodeValue(raw: string): unknown {
  try {
    return stripPrototypeKeys(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function setDeep(target: Plain, path: string[], value: unknown): void {
  let cursor: Plain = target;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i]!;
    const next = cursor[seg];
    if (next && typeof next === "object" && !Array.isArray(next)) {
      cursor = next as Plain;
    } else {
      const fresh: Plain = {};
      cursor[seg] = fresh;
      cursor = fresh;
    }
  }
  cursor[path[path.length - 1]!] = value;
}
