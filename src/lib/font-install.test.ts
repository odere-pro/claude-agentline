import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_NERD_FONT_URL, installNerdFont, resolveFontDir } from "./font-install.js";

function makeFetch(spec: {
  ok?: boolean;
  status?: number;
  body?: Buffer;
  throws?: unknown;
}): typeof fetch {
  return (async (..._args: unknown[]) => {
    if (spec.throws !== undefined) throw spec.throws;
    const body = spec.body ?? Buffer.from([]);
    return {
      ok: spec.ok ?? true,
      status: spec.status ?? 200,
      arrayBuffer: async () =>
        body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  }) as unknown as typeof fetch;
}

describe("resolveFontDir", () => {
  it("uses ~/Library/Fonts on darwin", () => {
    const dir = resolveFontDir({ env: {}, home: "/u/alex", platform: "darwin" });
    expect(dir).toBe("/u/alex/Library/Fonts");
  });

  it("uses ${XDG_DATA_HOME}/fonts on linux when XDG_DATA_HOME is set", () => {
    const dir = resolveFontDir({
      env: { XDG_DATA_HOME: "/tmp/share" },
      home: "/h/alex",
      platform: "linux",
    });
    expect(dir).toBe("/tmp/share/fonts");
  });

  it("falls back to ~/.local/share/fonts on linux when XDG_DATA_HOME is unset", () => {
    const dir = resolveFontDir({ env: {}, home: "/h/alex", platform: "linux" });
    expect(dir).toBe("/h/alex/.local/share/fonts");
  });

  it("uses ${LOCALAPPDATA}/Microsoft/Windows/Fonts on win32", () => {
    const dir = resolveFontDir({
      env: { LOCALAPPDATA: "C:\\Users\\Alex\\AppData\\Local" },
      home: "C:\\Users\\Alex",
      platform: "win32",
    });
    expect(dir).toBe("C:\\Users\\Alex\\AppData\\Local/Microsoft/Windows/Fonts");
  });

  it("falls back to %HOME%/AppData/Local on win32 when LOCALAPPDATA is unset", () => {
    const dir = resolveFontDir({
      env: {},
      home: "C:\\Users\\Alex",
      platform: "win32",
    });
    expect(dir).toBe("C:\\Users\\Alex/AppData/Local/Microsoft/Windows/Fonts");
  });
});

describe("DEFAULT_NERD_FONT_URL", () => {
  it("points at a pinned ryanoasis/nerd-fonts release zip", () => {
    expect(DEFAULT_NERD_FONT_URL).toMatch(
      /^https:\/\/github\.com\/ryanoasis\/nerd-fonts\/releases\/download\/v[0-9.]+\/[A-Za-z]+\.zip$/,
    );
  });
});

describe("installNerdFont", () => {
  let fontDir: string;

  beforeEach(async () => {
    fontDir = await fs.mkdtemp(join(tmpdir(), "agentline-fontdir-"));
  });

  afterEach(async () => {
    await fs.rm(fontDir, { recursive: true, force: true });
  });

  it("returns { error } on a non-OK HTTP response", async () => {
    const result = await installNerdFont({
      fontDir,
      fetchImpl: makeFetch({ ok: false, status: 503 }),
    });
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/HTTP 503/);
  });

  it("returns { error } when the fetch throws (network unreachable)", async () => {
    const result = await installNerdFont({
      fontDir,
      fetchImpl: makeFetch({ throws: new Error("ENETUNREACH") }),
    });
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/ENETUNREACH/);
  });

  it("returns { error } when the tar binary is missing", async () => {
    // Body is empty but non-zero size so we get past the fetch and reach tar.
    const result = await installNerdFont({
      fontDir,
      fetchImpl: makeFetch({ body: Buffer.from([0, 1, 2, 3]) }),
      tarBin: "/nonexistent/agentline-fake-tar",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/tar failed/);
  });

  it("returns { installed } listing the .ttf/.otf files added by tar", async () => {
    // Stub `tar` with a shell script that writes two .ttf files into cwd.
    const tarStub = join(fontDir, "..", `agentline-fake-tar-${Date.now()}.sh`);
    await fs.writeFile(
      tarStub,
      `#!/bin/sh\ntouch "${fontDir}/JetBrainsMonoNerdFont-Regular.ttf"\ntouch "${fontDir}/JetBrainsMonoNerdFont-Bold.ttf"\nexit 0\n`,
      { mode: 0o700 },
    );
    try {
      const result = await installNerdFont({
        fontDir,
        fetchImpl: makeFetch({ body: Buffer.from([0]) }),
        tarBin: tarStub,
      });
      expect("installed" in result).toBe(true);
      if ("installed" in result) {
        expect([...result.installed].sort()).toEqual([
          "JetBrainsMonoNerdFont-Bold.ttf",
          "JetBrainsMonoNerdFont-Regular.ttf",
        ]);
      }
    } finally {
      await fs.unlink(tarStub).catch(() => undefined);
    }
  });

  it("returns { error } when the abort signal fires before the fetch resolves", async () => {
    const slowFetch = (async (_url: unknown, init: RequestInit) => {
      const signal = init.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }) as unknown as typeof fetch;
    const result = await installNerdFont({
      fontDir,
      fetchImpl: slowFetch,
      timeoutMs: 50,
    });
    expect("error" in result).toBe(true);
  });
});
