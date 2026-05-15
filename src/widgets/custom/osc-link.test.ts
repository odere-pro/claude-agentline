import { describe, expect, it } from "vitest";

import type { WidgetContext } from "../context.js";
import { oscLinkWidget } from "./osc-link.js";

const ctx = {} as WidgetContext;

function render(options: Record<string, unknown>) {
  return oscLinkWidget.render(ctx, { options, rawValue: false });
}

describe("osc-link widget", () => {
  it("returns hidden cell when url is missing", () => {
    const cell = render({});
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
    expect(cell.href).toBeUndefined();
  });

  it("returns hidden cell when url is empty string", () => {
    const cell = render({ url: "", label: "Docs" });
    expect(cell.hidden).toBe(true);
  });

  it("returns hidden cell when url is whitespace only", () => {
    const cell = render({ url: "   ", label: "Docs" });
    expect(cell.hidden).toBe(true);
  });

  it("uses label as visible text when both label and url are set", () => {
    const cell = render({ url: "https://example.com", label: "Docs" });
    expect(cell.text).toBe("Docs");
    expect(cell.href).toBe("https://example.com");
  });

  it("falls back to url as the visible label when label is omitted", () => {
    const cell = render({ url: "https://example.com" });
    expect(cell.text).toBe("https://example.com");
    expect(cell.href).toBe("https://example.com");
  });

  it("trims surrounding whitespace from url and label", () => {
    const cell = render({ url: "  https://example.com  ", label: "  Docs  " });
    expect(cell.text).toBe("Docs");
    expect(cell.href).toBe("https://example.com");
  });

  it("falls back to url when label is whitespace only", () => {
    const cell = render({ url: "https://example.com", label: "   " });
    expect(cell.text).toBe("https://example.com");
  });

  it("ignores non-string options", () => {
    const cell = render({ url: 42, label: { broken: true } });
    expect(cell.hidden).toBe(true);
  });

  it("visible width equals label length, not the inflated escape sequence", () => {
    const cell = render({ url: "https://example.com/very/long/path", label: "Docs" });
    /*
     * The OSC 8 escape is applied by the encoder, not the widget. The
     * cell.text the layout engine sees stays the bare label — this is
     * the invariant width math depends on.
     */
    expect(cell.text.length).toBe(4);
  });
});
