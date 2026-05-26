import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadGitSnapshot } from "./snapshot.js";

interface RepoFixture {
  readonly path: string;
}

function git(repo: string, args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  }).trim();
}

function makeRepo(): RepoFixture {
  const path = mkdtempSync(join(tmpdir(), "agentline-git-"));
  git(path, ["init", "-q", "-b", "main"]);
  git(path, ["config", "commit.gpgsign", "false"]);
  // Windows defaults `core.autocrlf` to true, which lets `git diff
  // --numstat` report 0 insertions for an LF-written change (the working
  // tree and index disagree only on line endings) — the file/stage counts
  // stay right but the insertion count flakes to 0. Pin LF semantics so
  // diff stats are deterministic across platforms.
  git(path, ["config", "core.autocrlf", "false"]);
  git(path, ["config", "core.safecrlf", "false"]);
  return { path };
}

describe("loadGitSnapshot", () => {
  it("returns available:false when cwd is not a git repo", () => {
    const tmp = mkdtempSync(join(tmpdir(), "agentline-nogit-"));
    try {
      const snap = loadGitSnapshot({ cwd: tmp });
      expect(snap.available).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns available:false when cwd is undefined", () => {
    expect(loadGitSnapshot({ cwd: undefined }).available).toBe(false);
  });

  describe("on a populated repo", () => {
    let repo: RepoFixture;

    beforeAll(() => {
      repo = makeRepo();
      writeFileSync(join(repo.path, "a.txt"), "hello\n");
      git(repo.path, ["add", "a.txt"]);
      git(repo.path, ["commit", "-q", "-m", "init"]);
    });

    afterAll(() => {
      rmSync(repo.path, { recursive: true, force: true });
    });

    it("captures branch, sha, and clean status", () => {
      const snap = loadGitSnapshot({ cwd: repo.path });
      if (!snap.available) throw new Error("expected available snapshot");
      expect(snap.branch).toBe("main");
      expect(snap.detached).toBe(false);
      expect(snap.sha).toMatch(/^[0-9a-f]{40}$/);
      expect(snap.shortSha).toMatch(/^[0-9a-f]{7}$/);
      expect(snap.status.staged).toBe(0);
      expect(snap.status.unstaged).toBe(0);
      expect(snap.status.untracked).toBe(0);
      expect(snap.status.conflicts).toBe(0);
    });

    it("counts unstaged + staged + untracked changes", () => {
      const r = makeRepo();
      try {
        writeFileSync(join(r.path, "tracked.txt"), "v1\n");
        git(r.path, ["add", "tracked.txt"]);
        git(r.path, ["commit", "-q", "-m", "init"]);

        writeFileSync(join(r.path, "tracked.txt"), "v2\n");
        writeFileSync(join(r.path, "staged.txt"), "new\n");
        git(r.path, ["add", "staged.txt"]);
        writeFileSync(join(r.path, "fresh.txt"), "untracked\n");

        const snap = loadGitSnapshot({ cwd: r.path });
        if (!snap.available) throw new Error("expected available");
        expect(snap.status.staged).toBe(1);
        expect(snap.status.unstaged).toBe(1);
        expect(snap.status.untracked).toBe(1);
        expect(snap.diff.insertions).toBeGreaterThanOrEqual(1);
        expect(snap.diffStaged.insertions).toBeGreaterThanOrEqual(1);
      } finally {
        rmSync(r.path, { recursive: true, force: true });
      }
    });

    // Windows + Node 22 occasionally returns `--is-inside-work-tree` !=
    // "true" for ~1s after `git checkout --detach` against a freshly
    // committed ref — the FS state hasn't propagated yet. Same test
    // passes on every other OS × Node combo. Retry absorbs the flake.
    it("reports detached HEAD with the short SHA as branch", { retry: 2 }, () => {
      const r = makeRepo();
      try {
        writeFileSync(join(r.path, "a.txt"), "v1\n");
        git(r.path, ["add", "a.txt"]);
        git(r.path, ["commit", "-q", "-m", "c1"]);
        const sha = git(r.path, ["rev-parse", "HEAD"]);
        git(r.path, ["checkout", "-q", "--detach", sha]);
        const snap = loadGitSnapshot({ cwd: r.path });
        if (!snap.available) throw new Error("expected available");
        expect(snap.detached).toBe(true);
        expect(snap.branch).toBe(snap.shortSha);
      } finally {
        rmSync(r.path, { recursive: true, force: true });
      }
    });

    it("reports origin owner/repo when remote is set", () => {
      const r = makeRepo();
      try {
        git(r.path, ["remote", "add", "origin", "git@github.com:foo/bar.git"]);
        writeFileSync(join(r.path, "a.txt"), "x\n");
        git(r.path, ["add", "a.txt"]);
        git(r.path, ["commit", "-q", "-m", "c"]);
        const snap = loadGitSnapshot({ cwd: r.path });
        if (!snap.available) throw new Error("expected available");
        expect(snap.origin).toEqual({ owner: "foo", repo: "bar" });
      } finally {
        rmSync(r.path, { recursive: true, force: true });
      }
    });

    it("origin is null when no remote configured", () => {
      const snap = loadGitSnapshot({ cwd: repo.path });
      if (!snap.available) throw new Error("expected available");
      expect(snap.origin).toBeNull();
    });

    it("snapshot.pr defaults to null without the allowPullRequest opt-in", () => {
      const snap = loadGitSnapshot({ cwd: repo.path });
      if (!snap.available) throw new Error("expected available");
      expect(snap.pr).toBeNull();
    });
  });
});
