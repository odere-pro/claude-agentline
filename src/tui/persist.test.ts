import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_CONFIG } from "../config/index.js";
import type { AgentlineConfig } from "../config/types.js";
import { saveEditedConfig } from "./persist.js";

describe("saveEditedConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), "agentline-persist-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("writes file and returns config with the provided lines", async () => {
    const path = join(dir, "out.json");
    const lines = [{ widgets: [{ type: "model" }] }];
    const result = await saveEditedConfig({ path, base: DEFAULT_CONFIG, lines });
    expect(Array.isArray(result.lines)).toBe(true);
    const written = JSON.parse(await fs.readFile(path, "utf8"));
    expect(Array.isArray(written.lines)).toBe(true);
  });

  it("returned config preserves base fields outside of lines", async () => {
    const path = join(dir, "out.json");
    const lines = [{ widgets: [{ type: "clock" }] }];
    const result = await saveEditedConfig({ path, base: DEFAULT_CONFIG, lines });
    expect(result.version).toBe(DEFAULT_CONFIG.version);
  });

  it("returned config has the new lines", async () => {
    const path = join(dir, "out.json");
    const lines = [{ widgets: [{ type: "model" }] }];
    const result = await saveEditedConfig({ path, base: DEFAULT_CONFIG, lines });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.widgets[0]?.type).toBe("model");
  });

  it("throws before writing when config has invalid version type", async () => {
    const path = join(dir, "invalid.json");
    const bad = { ...DEFAULT_CONFIG, version: "wrong" } as unknown as AgentlineConfig;
    await expect(saveEditedConfig({ path, base: bad, lines: [] })).rejects.toThrow();
    await expect(fs.access(path)).rejects.toThrow();
  });
});
