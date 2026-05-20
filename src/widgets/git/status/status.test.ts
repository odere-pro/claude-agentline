import { describe, expect, it } from "vitest";

import type { GitState } from "../../../data/git/index.js";
import type { WidgetContext } from "../../types.js";

import {
  makeGitSnapshot as makeSnapshot,
  makeWidgetContext,
} from "../../../test-helpers/index.js";

import { gitUntrackedWidget } from "./status.js";

const makeCtx = (git: GitState | undefined, overrides: Partial<WidgetContext> = {}) =>
  makeWidgetContext({ git, ...overrides });

describe("git-untracked widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitUntrackedWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides at zero by default", () => {
    const cell = gitUntrackedWidget.render(makeCtx(makeSnapshot()), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders the untracked count", () => {
    const snap = makeSnapshot({
      status: { staged: 0, unstaged: 0, untracked: 5, conflicts: 0, modified: 0, added: 0 },
    });
    const cell = gitUntrackedWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("5");
  });

  it("suppresses label when rawValue: true", () => {
    const snap = makeSnapshot({
      status: { staged: 0, unstaged: 0, untracked: 1, conflicts: 0, modified: 0, added: 0 },
    });
    const withLabel = gitUntrackedWidget.render(makeCtx(snap), {
      options: { label: "?" },
      rawValue: false,
    });
    const noLabel = gitUntrackedWidget.render(makeCtx(snap), {
      options: { label: "?" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("?1");
    expect(noLabel.text).toBe("1");
  });
});
