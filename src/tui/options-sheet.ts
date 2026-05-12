/**
 * Per-widget options sheet for the `agentline config` editor.
 *
 * Opened with `o`; shown while the reducer's mode is `"options"`. Presents
 * the three commonly-toggled widget properties in plain English — visible /
 * hidden, the widget's own label, and spacing to the neighbour — and the
 * keys that change them. Pure component: `App` owns the key handling and
 * dispatches the reducer's `toggle-hidden` / `toggle-raw` / `cycle-merge`;
 * this just draws the current state.
 *
 * Imported only from the lazily-loaded TUI bundle.
 */

import { Box, Text } from "ink";
import React from "react";

import type { WidgetConfig } from "../config/types.js";

const SPACING_LABEL: Record<NonNullable<WidgetConfig["merged"]>, string> = {
  off: "full padding",
  merge: "single space",
  "merge-no-padding": "none (touching)",
};

/** The human-readable summary of a widget's toggled properties. */
export function optionsSummary(widget: WidgetConfig): readonly { key: string; label: string; value: string }[] {
  return [
    { key: "v", label: "visible", value: widget.hidden ? "hidden" : "shown" },
    { key: "l", label: "own label", value: widget.rawValue ? "hidden" : "shown" },
    { key: "m", label: "spacing to neighbour", value: SPACING_LABEL[widget.merged ?? "off"] },
  ];
}

export interface OptionsSheetProps {
  readonly widget: WidgetConfig;
}

export function OptionsSheet(props: OptionsSheetProps): React.ReactElement {
  const rows = optionsSummary(props.widget);
  const widestLabel = rows.reduce((n, r) => Math.max(n, r.label.length), 0);
  return React.createElement(
    Box,
    { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, marginTop: 1 },
    React.createElement(Text, { bold: true }, `options · ${props.widget.type}`),
    ...rows.map((r) =>
      React.createElement(
        Text,
        { key: r.key },
        `  ${r.key}  ${r.label.padEnd(widestLabel, " ")}  ${r.value}`,
      ),
    ),
    React.createElement(
      Text,
      { dimColor: true },
      "  v / l toggle · m cycles spacing · Esc close",
    ),
  );
}
