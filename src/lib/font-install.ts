/**
 * Best-effort JetBrainsMono Nerd Font installer used by `agentline
 * doctor --fix` (D05). Downloads the pinned release zip from the
 * upstream Nerd Fonts repo, extracts it into the platform's per-user
 * font directory via `tar -xf`, and reports what landed on disk.
 *
 * This module is the second place in agentline that initiates an
 * outbound HTTP request (the first is `src/update-check/fetch.ts`). It
 * is **never** imported from the render path or from any module the
 * render path transitively depends on — gate 14 (`no-network-render`)
 * is the trip-wire if that invariant slips.
 *
 * Contract:
 *   - Returns `{ installed: [...] }` on success, `{ error: "..." }` on
 *     any failure path (network, HTTP non-2xx, missing `tar`, font
 *     directory unwritable, abort).
 *   - Never throws.
 *   - Honours a single 60s timeout via `AbortController` so the whole
 *     download + extract sequence can't stall a `doctor --fix` run.
 *
 * `tar -xf <zip>` works on macOS 10.9+, Linux (GNU/BSD tar), and
 * Windows 10 1803+ — chosen over a JS unzip dependency so we keep
 * agentline pure-JS at the runtime-deps boundary while still extracting
 * binary archive formats.
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export const DEFAULT_NERD_FONT_URL =
  "https://github.com/ryanoasis/nerd-fonts/releases/download/v3.4.0/JetBrainsMono.zip";

const DEFAULT_TIMEOUT_MS = 60_000;
const TAR_BIN = "tar";

export interface ResolveFontDirParts {
  readonly env: NodeJS.ProcessEnv;
  readonly home: string;
  readonly platform: NodeJS.Platform;
}

/**
 * Resolve the per-user font directory for the current platform. Does
 * not touch disk — callers are responsible for `mkdir -p` before
 * writing.
 */
export function resolveFontDir(parts: ResolveFontDirParts): string {
  if (parts.platform === "darwin") {
    return join(parts.home, "Library", "Fonts");
  }
  if (parts.platform === "win32") {
    const localAppData = parts.env.LOCALAPPDATA ?? join(parts.home, "AppData", "Local");
    return join(localAppData, "Microsoft", "Windows", "Fonts");
  }
  const xdg = parts.env.XDG_DATA_HOME ?? join(parts.home, ".local", "share");
  return join(xdg, "fonts");
}

export interface InstallNerdFontOptions {
  readonly fontDir: string;
  readonly url?: string;
  readonly timeoutMs?: number;
  /** Test seam — defaults to global `fetch`. */
  readonly fetchImpl?: typeof fetch;
  /** Test seam — overrides the `tar` binary path. */
  readonly tarBin?: string;
}

export type InstallNerdFontResult =
  | { readonly installed: readonly string[] }
  | { readonly error: string };

export async function installNerdFont(
  opts: InstallNerdFontOptions,
): Promise<InstallNerdFontResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = opts.url ?? DEFAULT_NERD_FONT_URL;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const tarBin = opts.tarBin ?? TAR_BIN;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const tmpFile = join(tmpdir(), `agentline-nerd-font-${randomBytes(6).toString("hex")}.zip`);
  let tmpCreated = false;
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/octet-stream", "user-agent": "agentline-font-install" },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { error: `download failed: HTTP ${response.status}` };
    }
    const buf = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(tmpFile, buf, { mode: 0o600 });
    tmpCreated = true;

    await fs.mkdir(opts.fontDir, { recursive: true, mode: 0o700 });
    const before = await listFontFiles(opts.fontDir);
    const tarResult = await runTar(tarBin, tmpFile, opts.fontDir, controller.signal);
    if (tarResult.error !== undefined) {
      return { error: tarResult.error };
    }
    const after = await listFontFiles(opts.fontDir);
    const added: string[] = [];
    for (const name of after) {
      if (!before.has(name)) added.push(name);
    }
    return { installed: added };
  } catch (err: unknown) {
    return { error: messageOf(err) };
  } finally {
    clearTimeout(timer);
    if (tmpCreated) {
      await fs.unlink(tmpFile).catch(() => undefined);
    }
  }
}

interface TarResult {
  readonly error?: string;
}

function runTar(
  bin: string,
  archive: string,
  cwd: string,
  signal: AbortSignal,
): Promise<TarResult> {
  return new Promise((resolve) => {
    execFile(
      bin,
      ["-xf", archive],
      { cwd, signal, windowsHide: true, timeout: DEFAULT_TIMEOUT_MS },
      (err, _stdout, stderr) => {
        if (err) {
          const detail =
            typeof stderr === "string" && stderr.trim().length > 0 ? stderr.trim() : err.message;
          resolve({ error: `tar failed: ${detail.slice(0, 200)}` });
          return;
        }
        resolve({});
      },
    );
  });
}

async function listFontFiles(dir: string): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(dir);
    return new Set(entries.filter((name) => /\.(ttf|otf)$/i.test(name)));
  } catch {
    return new Set();
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "unknown error";
}
