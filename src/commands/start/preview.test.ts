import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "../../data/config/defaults/defaults.js";
import { renderStartPreview } from "./preview.js";

describe("renderStartPreview", () => {
  it("renders the user's config through the render path", async () => {
    const render = vi.fn(
      async (_payload: string, _options?: { config?: unknown }) => "[s] Opus 4.8\n",
    );
    const out = await renderStartPreview({
      load: async () => ({ config: DEFAULT_CONFIG }),
      render,
      cwd: "/tmp/agentline-preview",
    });
    expect(out).toBe("[s] Opus 4.8\n");
    expect(render).toHaveBeenCalledTimes(1);
    // The synthetic payload is the first arg; config is forwarded as an option.
    const [payload, options] = render.mock.calls[0]!;
    expect(JSON.parse(payload).cwd).toBe("/tmp/agentline-preview");
    expect(options?.config).toBe(DEFAULT_CONFIG);
  });

  it("returns undefined when the config cannot be loaded", async () => {
    const out = await renderStartPreview({
      load: async () => {
        throw new Error("broken config");
      },
    });
    expect(out).toBeUndefined();
  });

  it("returns undefined when the render throws", async () => {
    const out = await renderStartPreview({
      load: async () => ({ config: DEFAULT_CONFIG }),
      render: async () => {
        throw new Error("render boom");
      },
    });
    expect(out).toBeUndefined();
  });

  it("uses the real render pipeline end-to-end with the default config", async () => {
    const out = await renderStartPreview({
      load: async () => ({ config: DEFAULT_CONFIG }),
      cwd: "/tmp/agentline-preview",
    });
    expect(typeof out).toBe("string");
    expect((out ?? "").length).toBeGreaterThan(0);
  });
});
