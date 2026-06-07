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
import { WIDGET_CATALOG } from "../catalog.js";
import {
  KNOWN_OPTION_KEYS,
  validateWidgetOption,
  validateWidgetOptions,
} from "./option-spec.js";

/**
 * The audited (widget type → option keys it reads) map. Mirrors every
 * `settings.options.*` read in the widget sources. If a widget starts
 * reading a new option, add it here AND to the spec, or the strict
 * validator will reject a legitimate config.
 */
const AUDITED_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  clock: ["label", "format", "seconds"],
  "account-email": ["label", "mask"],
  "output-style": ["label", "showDefault"],
  "cwd-path": ["label", "maxLength"],
  "project-dir": ["label", "full"],
  "thinking-enabled": ["label", "showOff"],
  "api-duration": ["label", "percent"],
  tokens: ["label", "inputGlyph", "outputGlyph", "reset"],
  "tokens-cached": ["label", "inputGlyph", "outputGlyph", "reset"],
  "token-speed": ["label", "windowSec", "inputGlyph", "outputGlyph"],
  "git-changes": ["label", "hideZero"],
  "git-ahead-behind": ["label", "aheadGlyph", "behindGlyph", "glyph", "hideEven"],
  "git-conflicts": ["label", "glyph"],
  "git-pr": ["label", "allowNetwork", "variant"],
  "session-id": ["label", "length"],
  "session-weekly-usage": ["label", "plan"],
  "reset-timer": ["label", "format", "resetHour", "resetWeekday", "tz"],
  "context-percentage": ["label", "showCached"],
  "cost-vs-limit": ["label", "budget"],
};

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

describe("strict per-widget validation (F-A part 1)", () => {
  it("now rejects an unknown key on a variant-less widget (the whole point)", () => {
    const err = validateWidgetOption("model", "notakey", "x");
    expect(err).not.toBeNull();
    expect(err).toContain("notakey");
    expect(err).toContain("model");

    const err2 = validateWidgetOption("git-branch", "bogus", true);
    expect(err2).not.toBeNull();
    expect(err2).toContain("bogus");
  });

  it("knows every option key each shipped widget legitimately reads (no false rejections)", () => {
    // Key-level coverage: every audited key the widget reads must be in its
    // known set, so a config that sets it is never rejected as "unknown".
    for (const [type, keys] of Object.entries(AUDITED_OPTIONS)) {
      const known = KNOWN_OPTION_KEYS[type] ?? [];
      for (const key of keys) {
        expect(known, `${type} should know option '${key}'`).toContain(key);
      }
    }
  });

  it("does not over-declare — every known key is one the widget actually reads", () => {
    // Reverse coverage: the spec must not list keys the widget never reads
    // (dead spec entries). `reset` is implicit on reset-bearing widgets.
    for (const [type, keys] of Object.entries(AUDITED_OPTIONS)) {
      const known = (KNOWN_OPTION_KEYS[type] ?? []).filter((k) => k !== "reset");
      const audited = keys.filter((k) => k !== "reset");
      expect([...known].sort()).toEqual([...audited].sort());
    }
  });

  it("every registered widget type has a knownOptions entry (coverage)", () => {
    const missing = Object.keys(WIDGET_CATALOG).filter((t) => !(t in KNOWN_OPTION_KEYS));
    expect(missing).toEqual([]);
  });

  it("KNOWN_OPTION_KEYS includes `label` for every widget", () => {
    for (const keys of Object.values(KNOWN_OPTION_KEYS)) {
      expect(keys).toContain("label");
    }
  });
});
