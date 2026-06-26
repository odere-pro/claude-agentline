import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadGitSnapshot, resolveField, type GitSnapshot } from "./snapshot.js";

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

/**
 * Make a minimal git repo with one commit and return its path.
 * The caller must rmSync the path when done.
 */
function makeTmpRepo(): string {
  const path = mkdtempSync(join(tmpdir(), "agentline-hostpr-"));
  git(path, ["init", "-q", "-b", "main"]);
  git(path, ["config", "commit.gpgsign", "false"]);
  writeFileSync(join(path, "a.txt"), "hello\n");
  git(path, ["add", "a.txt"]);
  git(path, ["commit", "-q", "-m", "init"]);
  return path;
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

  // Windows CI occasionally returns `--is-inside-work-tree` != "true" for
  // ~1s after git operations on a freshly created temp repo (the FS state
  // hasn't propagated yet), so `loadGitSnapshot` flakes to available:false.
  // Observed on both Node 20 and 22; passes on every macOS/Linux combo and
  // in production (real repos are never created microseconds before render).
  // Retry absorbs the propagation delay for the whole populated-repo suite.
  describe("on a populated repo", { retry: 2 }, () => {
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

    it("reports detached HEAD with the short SHA as branch", () => {
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

    it("ignores the previous snapshot when the live read succeeds", () => {
      // A successful tick must show fresh data, never the cached value.
      const stale = makePrevious({ branch: "stale-branch", detached: false });
      const snap = loadGitSnapshot({ cwd: repo.path, previous: stale });
      if (!snap.available) throw new Error("expected available");
      expect(snap.branch).toBe("main");
    });
  });

  describe("host-first PR bridge", () => {
    it("uses hostPr when number is a valid integer and url is non-empty", () => {
      // A non-existent cwd guarantees gh is never reached; host pr must survive.
      // The cwd does not exist so git detects "not a repo" — transient miss
      // with no previous → available:false. The next test uses a real repo
      // to confirm the full host-wins path.
      const snap = loadGitSnapshot({
        cwd: "/definitely-not-a-real-path-xyz123",
        hostPr: { number: 244, url: "https://github.com/odere-pro/agentline/pull/244" },
      });
      expect(snap).toBeDefined();
      expect(snap.available).toBe(false);
    });

    it("hostPr produces a frozen pr object with title empty, skipping gh", () => {
      // Use a real temp repo (allowPullRequest NOT set) to prove host wins.
      const r = makeTmpRepo();
      try {
        const snap = loadGitSnapshot({
          cwd: r,
          hostPr: { number: 7, url: "https://github.com/owner/repo/pull/7" },
        });
        if (!snap.available) throw new Error("expected available");
        expect(snap.pr).toEqual({ number: 7, url: "https://github.com/owner/repo/pull/7", title: "" });
        expect(Object.isFrozen(snap.pr)).toBe(true);
      } finally {
        rmSync(r, { recursive: true, force: true });
      }
    });

    it("hostPr wins over allowPullRequest=true (gh never called)", () => {
      // Provide a hostPr and also allowPullRequest=true; host must win.
      // We verify behaviourally: gh would fail in CI (no auth), but the
      // snapshot still comes back with the host's number.
      const r = makeTmpRepo();
      try {
        const snap = loadGitSnapshot({
          cwd: r,
          hostPr: { number: 99, url: "https://github.com/foo/bar/pull/99" },
          allowPullRequest: true,
        });
        if (!snap.available) throw new Error("expected available");
        expect(snap.pr?.number).toBe(99);
      } finally {
        rmSync(r, { recursive: true, force: true });
      }
    });

    it("falls through to allowPullRequest path when hostPr is absent", () => {
      // No hostPr + no allowPullRequest → pr stays null.
      const r = makeTmpRepo();
      try {
        const snap = loadGitSnapshot({ cwd: r });
        if (!snap.available) throw new Error("expected available");
        expect(snap.pr).toBeNull();
      } finally {
        rmSync(r, { recursive: true, force: true });
      }
    });

    it("ignores malformed hostPr (number <= 0)", () => {
      const r = makeTmpRepo();
      try {
        const snap = loadGitSnapshot({
          cwd: r,
          hostPr: { number: 0, url: "https://github.com/foo/bar/pull/0" },
        });
        if (!snap.available) throw new Error("expected available");
        expect(snap.pr).toBeNull();
      } finally {
        rmSync(r, { recursive: true, force: true });
      }
    });

    it("ignores malformed hostPr (empty url)", () => {
      const r = makeTmpRepo();
      try {
        const snap = loadGitSnapshot({
          cwd: r,
          hostPr: { number: 5, url: "" },
        });
        if (!snap.available) throw new Error("expected available");
        expect(snap.pr).toBeNull();
      } finally {
        rmSync(r, { recursive: true, force: true });
      }
    });

    it("ignores malformed hostPr (url absent)", () => {
      const r = makeTmpRepo();
      try {
        const snap = loadGitSnapshot({ cwd: r, hostPr: { number: 5 } });
        if (!snap.available) throw new Error("expected available");
        expect(snap.pr).toBeNull();
      } finally {
        rmSync(r, { recursive: true, force: true });
      }
    });
  });

  describe("last-known-good fallback", () => {
    it("holds the previous snapshot when the gate read fails transiently", () => {
      // A non-existent cwd makes git's spawn fail (ENOENT) — a transient
      // miss, not a clean exit — so the prior snapshot must survive.
      const prev = makePrevious({ branch: "feature-x" });
      const snap = loadGitSnapshot({ cwd: "/definitely-not-a-real-path-xyz123", previous: prev });
      expect(snap).toBe(prev);
    });

    it("reports unavailable on a transient gate miss when there is no previous", () => {
      const snap = loadGitSnapshot({ cwd: "/definitely-not-a-real-path-xyz123" });
      expect(snap.available).toBe(false);
    });

    it("does NOT hold the previous snapshot in a genuine non-repo (clean exit)", () => {
      // A real, non-git directory makes `--is-inside-work-tree` exit
      // non-zero — a genuine "not a repo", which must clear the cache.
      const tmp = mkdtempSync(join(tmpdir(), "agentline-nogit-prev-"));
      try {
        const prev = makePrevious({ branch: "feature-x" });
        const snap = loadGitSnapshot({ cwd: tmp, previous: prev });
        expect(snap.available).toBe(false);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  describe("resolveField", () => {
    const parse = (raw: string | null): string => raw ?? "EMPTY";

    it("parses fresh output on success", () => {
      expect(resolveField({ ok: true, value: "fresh" }, parse, "prev")).toBe("fresh");
    });

    it("parses the empty value on a clean exit (genuine absence)", () => {
      expect(resolveField({ ok: false, reason: "exit" }, parse, "prev")).toBe("EMPTY");
    });

    it("reuses last-known-good on a transient miss", () => {
      expect(resolveField({ ok: false, reason: "transient" }, parse, "prev")).toBe("prev");
    });

    it("falls back to the empty value on a transient miss with no previous", () => {
      expect(resolveField({ ok: false, reason: "transient" }, parse, undefined)).toBe("EMPTY");
    });
  });
});

/** Minimal frozen GitSnapshot for fallback tests. */
function makePrevious(overrides: Partial<GitSnapshot> = {}): GitSnapshot {
  return Object.freeze({
    available: true,
    cwd: "/cached/repo",
    branch: "main",
    detached: false,
    sha: "0".repeat(40),
    shortSha: "0000000",
    status: { staged: 0, unstaged: 0, untracked: 0, conflicts: 0, modified: 0, added: 0 },
    diff: { insertions: 0, deletions: 0, filesChanged: 0 },
    diffStaged: { insertions: 0, deletions: 0, filesChanged: 0 },
    aheadBehind: { ahead: 0, behind: 0 },
    upstream: null,
    origin: null,
    upstreamRemote: null,
    worktreeName: null,
    inWorktree: false,
    pr: null,
    ...overrides,
  });
}
