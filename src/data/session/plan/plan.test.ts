import { mkdtempSync, rmSync, writeFileSync, mkdirSync, utimesSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadPlanSnapshot, resolvePlansDir } from "./plan.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "agentline-plan-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function src(): { env: NodeJS.ProcessEnv } {
  return { env: { CLAUDE_CONFIG_DIR: tmp } };
}

describe("resolvePlansDir", () => {
  it("joins CLAUDE_CONFIG_DIR + plans", () => {
    expect(resolvePlansDir(src())).toBe(path.join(tmp, "plans"));
  });

  it("falls back to homedir/.claude/plans when env unset", () => {
    expect(resolvePlansDir({ env: {}, homedir: "/tmp/u" })).toBe(
      path.join("/tmp/u", ".claude", "plans"),
    );
  });
});

describe("loadPlanSnapshot", () => {
  it("returns null when the plans dir is absent — never throws", () => {
    expect(loadPlanSnapshot(src())).toBeNull();
  });

  it("returns null when the plans dir is empty", () => {
    mkdirSync(path.join(tmp, "plans"));
    expect(loadPlanSnapshot(src())).toBeNull();
  });

  it("returns null when the plans dir holds no .md files", () => {
    const dir = path.join(tmp, "plans");
    mkdirSync(dir);
    writeFileSync(path.join(dir, "notes.txt"), "x");
    expect(loadPlanSnapshot(src())).toBeNull();
  });

  it("picks the most-recently-modified .md, basename sans .md", () => {
    const dir = path.join(tmp, "plans");
    mkdirSync(dir);
    writeFileSync(path.join(dir, "old-plan.md"), "x");
    writeFileSync(path.join(dir, "new-plan.md"), "y");
    /*
     * Pin both files' mtimes to fixed absolute timestamps so the
     * assertion does not race the host clock or any fs-mtime
     * coalescing (`Date.now()` minus a relative offset can collide
     * with the second `writeFileSync`'s mtime on coarse-grained
     * filesystems).
     */
    const past = new Date("2020-01-01T00:00:00Z");
    const now = new Date("2020-01-02T00:00:00Z");
    utimesSync(path.join(dir, "old-plan.md"), past, past);
    utimesSync(path.join(dir, "new-plan.md"), now, now);
    expect(loadPlanSnapshot(src())).toEqual({
      name: "new-plan",
      href: pathToFileURL(path.join(dir, "new-plan.md")).href,
    });
  });

  it("ignores subdirectories, returning the newest plain .md file", () => {
    const dir = path.join(tmp, "plans");
    mkdirSync(dir);
    mkdirSync(path.join(dir, "archive.md"));
    writeFileSync(path.join(dir, "active.md"), "x");
    expect(loadPlanSnapshot(src())).toEqual({
      name: "active",
      href: pathToFileURL(path.join(dir, "active.md")).href,
    });
  });
});
