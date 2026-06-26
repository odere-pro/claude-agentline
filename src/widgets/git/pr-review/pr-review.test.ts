import { describe, expect, it } from "vitest";

import { makeStdinPayload, makeWidgetContext } from "../../../test-helpers/index.js";

import { gitPrReviewWidget } from "./pr-review.js";

describe("gitPrReviewWidget", () => {
  describe("glyph variant (default)", () => {
    it("renders ✓ for approved", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "approved" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.hidden).not.toBe(true);
      expect(cell.text).toBe("✓");
    });

    it("renders ✗ for changes_requested", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "changes_requested" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("✗");
    });

    it("renders … for pending", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "pending" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("…");
    });

    it("renders ◌ for draft", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "draft" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("◌");
    });

    it("explicitly selects glyph variant via options.variant", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "approved" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, {
        options: { variant: "glyph" },
        rawValue: false,
      });
      expect(cell.text).toBe("✓");
    });
  });

  describe("word variant", () => {
    it("renders 'approved' for approved", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "approved" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, {
        options: { variant: "word" },
        rawValue: false,
      });
      expect(cell.text).toBe("approved");
    });

    it("renders 'changes requested' for changes_requested", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "changes_requested" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, {
        options: { variant: "word" },
        rawValue: false,
      });
      expect(cell.text).toBe("changes requested");
    });

    it("renders 'pending' for pending", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "pending" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, {
        options: { variant: "word" },
        rawValue: false,
      });
      expect(cell.text).toBe("pending");
    });

    it("renders 'draft' for draft", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "draft" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, {
        options: { variant: "word" },
        rawValue: false,
      });
      expect(cell.text).toBe("draft");
    });
  });

  describe("hidden paths", () => {
    it("hides when ctx.stdin.pr is absent", () => {
      const ctx = makeWidgetContext({ stdin: makeStdinPayload() });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.hidden).toBe(true);
    });

    it("hides when ctx.stdin.pr.reviewState is absent", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { number: 42 } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.hidden).toBe(true);
    });

    it("hides when reviewState is an unknown value (forward-compat narrowing)", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "future_unknown_state" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.hidden).toBe(true);
    });

    it("hides on glyph variant for an unknown state", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "future_unknown_state" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, {
        options: { variant: "glyph" },
        rawValue: false,
      });
      expect(cell.hidden).toBe(true);
    });

    it("hides on word variant for an unknown state", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "future_unknown_state" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, {
        options: { variant: "word" },
        rawValue: false,
      });
      expect(cell.hidden).toBe(true);
    });
  });

  describe("default variant is glyph", () => {
    it("omitting options.variant renders glyph output", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "approved" } }),
      });
      const defaultCell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      const glyphCell = gitPrReviewWidget.render(ctx, {
        options: { variant: "glyph" },
        rawValue: false,
      });
      expect(defaultCell.text).toBe(glyphCell.text);
    });
  });

  describe("semantic signal colours", () => {
    it("approved glyph variant carries fg (git-clean role) and signal:true", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "approved" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.fg).toBeDefined();
      expect(cell.signal).toBe(true);
    });

    it("approved word variant carries fg (git-clean role) and signal:true", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "approved" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: { variant: "word" }, rawValue: false });
      expect(cell.fg).toBeDefined();
      expect(cell.signal).toBe(true);
    });

    it("changes_requested glyph variant carries fg (git-dirty role) and signal:true", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "changes_requested" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.fg).toBeDefined();
      expect(cell.signal).toBe(true);
    });

    it("changes_requested word variant carries fg (git-dirty role) and signal:true", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "changes_requested" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: { variant: "word" }, rawValue: false });
      expect(cell.fg).toBeDefined();
      expect(cell.signal).toBe(true);
    });

    it("pending state has no fg and no signal (neutral)", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "pending" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.fg).toBeUndefined();
      expect(cell.signal).toBeUndefined();
    });

    it("draft state has no fg and no signal (neutral)", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "draft" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.fg).toBeUndefined();
      expect(cell.signal).toBeUndefined();
    });
  });

  describe("label option (FIX 4)", () => {
    it("prefixes the label onto the glyph output", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "approved" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: { label: "PR:" }, rawValue: false });
      expect(cell.text).toBe("PR:✓");
    });

    it("prefixes the label onto the word output", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "pending" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, {
        options: { label: "Review: ", variant: "word" },
        rawValue: false,
      });
      expect(cell.text).toBe("Review: pending");
    });

    it("suppresses the label when rawValue:true", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "approved" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: { label: "PR:" }, rawValue: true });
      expect(cell.text).toBe("✓");
    });

    it("omitting label still renders glyph without prefix", () => {
      const ctx = makeWidgetContext({
        stdin: makeStdinPayload({ pr: { reviewState: "draft" } }),
      });
      const cell = gitPrReviewWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("◌");
    });
  });
});
