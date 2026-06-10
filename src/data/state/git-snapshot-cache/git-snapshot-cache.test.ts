import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GitSnapshot } from "../../git/snapshot/snapshot.js";
import {
  GIT_SNAPSHOT_CACHE_VERSION,
  readGitSnapshotSync,
  resolveGitSnapshotCacheFile,
  saveGitSnapshot,
} from "./git-snapshot-cache.js";

function makeSnapshot(overrides: Partial<GitSnapshot> = {}): GitSnapshot {
  return Object.freeze({
    available: true,
    cwd: "/repo/one",
    branch: "main",
    detached: false,
    sha: "a".repeat(40),
    shortSha: "aaaaaaa",
    status: { staged: 1, unstaged: 2, untracked: 3, conflicts: 0, modified: 1, added: 1 },
    diff: { insertions: 5, deletions: 2, filesChanged: 1 },
    diffStaged: { insertions: 0, deletions: 0, filesChanged: 0 },
    aheadBehind: { ahead: 1, behind: 0 },
    upstream: "origin/main",
    origin: { owner: "foo", repo: "bar" },
    upstreamRemote: null,
    worktreeName: null,
    inWorktree: false,
    pr: { number: 42, url: "https://example.com/pr/42", title: "Add thing" },
    ...overrides,
  });
}

describe("resolveGitSnapshotCacheFile", () => {
  it("keys per-cwd under $CLAUDE_CONFIG_DIR/state/git-snapshot", () => {
    const a = resolveGitSnapshotCacheFile("/repo/one", { CLAUDE_CONFIG_DIR: "/cfg" });
    const b = resolveGitSnapshotCacheFile("/repo/two", { CLAUDE_CONFIG_DIR: "/cfg" });
    expect(dirname(a)).toBe(join("/cfg", "state", "git-snapshot"));
    expect(a).not.toBe(b); // distinct cwds → distinct files
    expect(a.endsWith(".json")).toBe(true);
  });
});

describe("saveGitSnapshot + readGitSnapshotSync", () => {
  let tmp: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-git-cache-"));
    env = { CLAUDE_CONFIG_DIR: tmp };
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("round-trips a full snapshot keyed by cwd", async () => {
    const snap = makeSnapshot();
    await saveGitSnapshot(snap, { env, clock: () => new Date("2026-06-11T00:00:00Z") });
    const out = readGitSnapshotSync(snap.cwd, env);
    expect(out).toEqual(snap);
  });

  it("returns null for a cwd that was never cached", () => {
    expect(readGitSnapshotSync("/never/seen", env)).toBeNull();
  });

  it("does not persist an unavailable snapshot", async () => {
    // available:false has no cwd to key on — saving is a no-op.
    await saveGitSnapshot({ available: false } as unknown as GitSnapshot, { env });
    expect(readGitSnapshotSync("/repo/one", env)).toBeNull();
  });

  it("returns null when a different cwd is requested (collision guard)", async () => {
    const snap = makeSnapshot({ cwd: "/repo/one" });
    await saveGitSnapshot(snap, { env });
    // Hand-write the same file but claim a different cwd inside.
    const file = resolveGitSnapshotCacheFile("/repo/one", env);
    writeFileSync(
      file,
      JSON.stringify({
        version: GIT_SNAPSHOT_CACHE_VERSION,
        savedAt: "x",
        cwd: "/repo/elsewhere",
        snapshot: snap,
      }),
      "utf8",
    );
    expect(readGitSnapshotSync("/repo/one", env)).toBeNull();
  });

  it("returns null on a version mismatch", async () => {
    const snap = makeSnapshot();
    const file = resolveGitSnapshotCacheFile(snap.cwd, env);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({ version: 999, savedAt: "x", cwd: snap.cwd, snapshot: snap }),
      "utf8",
    );
    expect(readGitSnapshotSync(snap.cwd, env)).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    const file = resolveGitSnapshotCacheFile("/repo/one", env);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "{not json", "utf8");
    expect(readGitSnapshotSync("/repo/one", env)).toBeNull();
  });

  it("returns null when a required snapshot field is the wrong type", async () => {
    const snap = makeSnapshot();
    const file = resolveGitSnapshotCacheFile(snap.cwd, env);
    mkdirSync(dirname(file), { recursive: true });
    const broken = { ...snap, status: { staged: "nope" } };
    writeFileSync(
      file,
      JSON.stringify({
        version: GIT_SNAPSHOT_CACHE_VERSION,
        savedAt: "x",
        cwd: snap.cwd,
        snapshot: broken,
      }),
      "utf8",
    );
    expect(readGitSnapshotSync(snap.cwd, env)).toBeNull();
  });

  it("preserves null remotes / pr / upstream through the round-trip", async () => {
    const snap = makeSnapshot({ upstream: null, origin: null, pr: null, upstreamRemote: null });
    await saveGitSnapshot(snap, { env });
    const out = readGitSnapshotSync(snap.cwd, env);
    expect(out?.upstream).toBeNull();
    expect(out?.origin).toBeNull();
    expect(out?.pr).toBeNull();
  });

  it("is best-effort — a broken state dir does not throw", async () => {
    const broken = { CLAUDE_CONFIG_DIR: "\0/cannot/exist" };
    await expect(saveGitSnapshot(makeSnapshot(), { env: broken })).resolves.toBeUndefined();
  });
});
