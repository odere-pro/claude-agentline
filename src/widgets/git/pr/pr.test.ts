import { describe, expect, it } from "vitest";

import type { GitSnapshot, GitState } from "../../../data/git/index.js";

import { makeGitSnapshot, makeWidgetContext } from "../../../test-helpers/index.js";

import { gitPrWidget } from "./pr.js";

const prSnapshot = (overrides: Partial<GitSnapshot> = {}): GitSnapshot =>
  makeGitSnapshot({
    branch: "feat/x",
    pr: { number: 42, url: "https://github.com/owner/repo/pull/42", title: "feat: do the thing" },
    // Default to the network source so the pre-existing opt-in tests keep
    // their original meaning; host-source tests override this explicitly.
    prSource: "network",
    ...overrides,
  });

const ctxWithGit = (git: GitState | undefined) =>
  makeWidgetContext(git !== undefined ? { git } : {});

describe("gitPrWidget", () => {
  it("hides a network-sourced PR when allowNetwork is not set (opt-in preserved)", () => {
    const cell = gitPrWidget.render(ctxWithGit(prSnapshot({ prSource: "network" })), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders a host-sourced PR by default — no allowNetwork opt-in needed", () => {
    const cell = gitPrWidget.render(
      ctxWithGit(
        prSnapshot({
          prSource: "host",
          pr: { number: 42, url: "https://github.com/owner/repo/pull/42", title: "" },
        }),
      ),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).not.toBe(true);
    expect(cell.text).toBe("#42");
    expect(cell.href).toBe("https://github.com/owner/repo/pull/42");
  });

  it("renders a host-sourced PR even when allowNetwork is explicitly false", () => {
    const cell = gitPrWidget.render(ctxWithGit(prSnapshot({ prSource: "host" })), {
      options: { allowNetwork: false },
      rawValue: false,
    });
    expect(cell.hidden).not.toBe(true);
    expect(cell.text).toBe("#42");
  });

  it("renders a network-sourced PR once allowNetwork is opted in", () => {
    const cell = gitPrWidget.render(ctxWithGit(prSnapshot({ prSource: "network" })), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.hidden).not.toBe(true);
    expect(cell.text).toBe("#42");
  });

  it("hides when ctx.git is undefined even with allowNetwork", () => {
    const cell = gitPrWidget.render(ctxWithGit(undefined), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when the snapshot is unavailable", () => {
    const cell = gitPrWidget.render(ctxWithGit({ available: false }), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides a malformed snapshot (pr present but prSource null) — defense in depth", () => {
    const cell = gitPrWidget.render(ctxWithGit(prSnapshot({ prSource: null })), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when snapshot.pr is null (gh missing / no PR)", () => {
    const cell = gitPrWidget.render(ctxWithGit(prSnapshot({ pr: null })), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders #N by default", () => {
    const cell = gitPrWidget.render(ctxWithGit(prSnapshot()), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.hidden).not.toBe(true);
    expect(cell.text).toBe("#42");
  });

  it("sets cell.href to the PR url so the rendered PR is clickable", () => {
    const cell = gitPrWidget.render(ctxWithGit(prSnapshot()), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.href).toBe("https://github.com/owner/repo/pull/42");
  });

  it("renders the URL on the url variant", () => {
    const cell = gitPrWidget.render(ctxWithGit(prSnapshot()), {
      options: { allowNetwork: true, variant: "url" },
      rawValue: false,
    });
    expect(cell.text).toBe("https://github.com/owner/repo/pull/42");
  });

  it("renders the title on the title variant", () => {
    const cell = gitPrWidget.render(ctxWithGit(prSnapshot()), {
      options: { allowNetwork: true, variant: "title" },
      rawValue: false,
    });
    expect(cell.text).toBe("feat: do the thing");
  });

  it("renders #N + title on the number-title variant", () => {
    const cell = gitPrWidget.render(ctxWithGit(prSnapshot()), {
      options: { allowNetwork: true, variant: "number-title" },
      rawValue: false,
    });
    expect(cell.text).toBe("#42 · feat: do the thing");
  });

  it("falls back to #N for number-title when the PR has no title", () => {
    const cell = gitPrWidget.render(
      ctxWithGit(prSnapshot({ pr: { number: 7, url: "https://x/pull/7", title: "" } })),
      { options: { allowNetwork: true, variant: "number-title" }, rawValue: false },
    );
    expect(cell.text).toBe("#7");
  });

  it("falls back to number for an unknown variant", () => {
    const cell = gitPrWidget.render(ctxWithGit(prSnapshot()), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      options: { allowNetwork: true, variant: "weird" as any },
      rawValue: false,
    });
    expect(cell.text).toBe("#42");
  });

  it("prepends label and suppresses it under rawValue", () => {
    const labelled = gitPrWidget.render(ctxWithGit(prSnapshot()), {
      options: { allowNetwork: true, label: "PR " },
      rawValue: false,
    });
    expect(labelled.text).toBe("PR #42");
    const raw = gitPrWidget.render(ctxWithGit(prSnapshot()), {
      options: { allowNetwork: true, label: "PR " },
      rawValue: true,
    });
    expect(raw.text).toBe("#42");
  });
});
