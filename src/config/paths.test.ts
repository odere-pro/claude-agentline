import { describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { resolveConfigPaths } from "./paths.js";

describe("resolveConfigPaths", () => {
  it("uses homedir/.config when CLAUDE_CONFIG_DIR is unset", () => {
    const paths = resolveConfigPaths({}, "/project");
    expect(paths.userDir).toBe(join(homedir(), ".config", "agentline"));
  });

  it("uses CLAUDE_CONFIG_DIR when set", () => {
    const paths = resolveConfigPaths({ CLAUDE_CONFIG_DIR: "/custom/cfg" }, "/project");
    expect(paths.userDir).toBe("/custom/cfg/agentline");
  });

  it("uses cwd as project base when CLAUDE_PROJECT_DIR is unset", () => {
    const paths = resolveConfigPaths({}, "/my/project");
    expect(paths.projectConfig).toBe("/my/project/.agentline.json");
  });

  it("uses CLAUDE_PROJECT_DIR as project base when set", () => {
    const paths = resolveConfigPaths({ CLAUDE_PROJECT_DIR: "/other/project" }, "/my/project");
    expect(paths.projectConfig).toBe("/other/project/.agentline.json");
  });

  it("resolves relative CLAUDE_PROJECT_DIR against cwd", () => {
    const paths = resolveConfigPaths({ CLAUDE_PROJECT_DIR: "sub/dir" }, "/base");
    expect(paths.projectConfig).toBe(resolve("/base", "sub/dir", ".agentline.json"));
  });

  it("userConfig is always ${userDir}/config.json", () => {
    const paths = resolveConfigPaths({ CLAUDE_CONFIG_DIR: "/cfg" }, "/cwd");
    expect(paths.userConfig).toBe(join(paths.userDir, "config.json"));
  });

  it("projectConfig always ends with /.agentline.json", () => {
    const paths = resolveConfigPaths({}, "/cwd");
    expect(paths.projectConfig).toMatch(/\.agentline\.json$/);
  });

  it("all four combinations of env vars set/unset produce valid paths", () => {
    const combos = [
      {},
      { CLAUDE_CONFIG_DIR: "/a" },
      { CLAUDE_PROJECT_DIR: "/b" },
      { CLAUDE_CONFIG_DIR: "/a", CLAUDE_PROJECT_DIR: "/b" },
    ];
    for (const env of combos) {
      const paths = resolveConfigPaths(env, "/cwd");
      expect(typeof paths.userConfig).toBe("string");
      expect(typeof paths.userDir).toBe("string");
      expect(typeof paths.projectConfig).toBe("string");
    }
  });
});
