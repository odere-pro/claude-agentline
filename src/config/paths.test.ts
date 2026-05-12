import { describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

import { resolveConfigPaths } from "./paths.js";

describe("resolveConfigPaths", () => {
  it("uses homedir/.config when CLAUDE_CONFIG_DIR is unset", () => {
    const paths = resolveConfigPaths({});
    expect(paths.userDir).toBe(join(homedir(), ".config", "agentline"));
  });

  it("uses CLAUDE_CONFIG_DIR when set", () => {
    const paths = resolveConfigPaths({ CLAUDE_CONFIG_DIR: "/custom/cfg" });
    expect(paths.userDir).toBe("/custom/cfg/agentline");
  });

  it("userConfig is always ${userDir}/config.json", () => {
    const paths = resolveConfigPaths({ CLAUDE_CONFIG_DIR: "/cfg" });
    expect(paths.userConfig).toBe(join(paths.userDir, "config.json"));
  });

  it("treats an empty CLAUDE_CONFIG_DIR as unset", () => {
    const paths = resolveConfigPaths({ CLAUDE_CONFIG_DIR: "" });
    expect(paths.userDir).toBe(join(homedir(), ".config", "agentline"));
  });
});
