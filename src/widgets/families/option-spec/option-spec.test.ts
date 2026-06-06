/**
 * Tests for the catalogue-derived widget option spec + its validator.
 *
 * TDD — failing first. The spec is the single source of truth for which
 * option keys a widget accepts and which values are in range. It backs
 * the mutation-time validation in `config widget add` / `set-option`,
 * so a typo or an out-of-axis reset is rejected with a helpful message
 * instead of silently coerced.
 */

import { describe, expect, it } from "vitest";

import { RESET_AXES } from "../../../data/tokens/index.js";
import { validateWidgetOption, validateWidgetOptions } from "./option-spec.js";

describe("validateWidgetOption", () => {
  it("accepts the universal `label` key on any widget", () => {
    expect(validateWidgetOption("clock", "label", "t:")).toBeNull();
    expect(validateWidgetOption("git-branch", "label", "")).toBeNull();
  });

  it("rejects an unknown option key with a message naming the widget", () => {
    const err = validateWidgetOption("clock", "notakey", "x");
    expect(err).not.toBeNull();
    expect(err).toContain("notakey");
    expect(err).toContain("clock");
  });

  it("accepts a known catalogued option value (clock format)", () => {
    expect(validateWidgetOption("clock", "format", "12h")).toBeNull();
    expect(validateWidgetOption("clock", "format", "24h")).toBeNull();
  });

  it("rejects an out-of-range value for a catalogued option (clock format)", () => {
    const err = validateWidgetOption("clock", "format", "bogus");
    expect(err).not.toBeNull();
    expect(err).toContain("format");
    expect(err).toContain("bogus");
    expect(err).toContain("12h");
  });

  it("accepts a valid reset axis on a reset-bearing widget", () => {
    for (const axis of RESET_AXES) {
      expect(validateWidgetOption("tokens", "reset", axis)).toBeNull();
    }
  });

  it("rejects an out-of-axis reset value with a message listing the axes", () => {
    const err = validateWidgetOption("tokens", "reset", "bad");
    expect(err).not.toBeNull();
    expect(err).toContain("reset");
    expect(err).toContain("bad");
    expect(err).toContain("session");
  });

  it("rejects `reset` on a widget that does not take a reset axis", () => {
    const err = validateWidgetOption("clock", "reset", "session");
    expect(err).not.toBeNull();
    expect(err).toContain("reset");
  });

  it("returns null for an unknown widget type (type validity is checked elsewhere)", () => {
    expect(validateWidgetOption("nonsuch", "label", "x")).toBeNull();
  });
});

describe("validateWidgetOptions", () => {
  it("returns null when every key/value is valid", () => {
    expect(validateWidgetOptions("clock", { label: "t:", format: "12h" })).toBeNull();
  });

  it("returns the first failing key's message", () => {
    const err = validateWidgetOptions("clock", { format: "nope" });
    expect(err).not.toBeNull();
    expect(err).toContain("format");
  });

  it("accepts an empty options object", () => {
    expect(validateWidgetOptions("clock", {})).toBeNull();
  });
});
