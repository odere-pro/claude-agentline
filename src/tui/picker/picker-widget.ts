/**
 * Picker step 1b — pick a widget inside a chosen family. Live filter on
 * `type` and `name`; ↵ commits (jumps to PickerVariant if the widget
 * carries variants, otherwise back to edit).
 */

import { Box, Text } from "ink";
import React from "react";

import {
  createDictTranslator,
  identityTranslator,
  widgetDescId,
  type DictTranslator,
  type Translator,
} from "../../core/i18n/index.js";
import { DEFAULT_CONFIG } from "../../data/config/defaults/defaults.js";
import type { WidgetFamily, WidgetMetaEntry } from "../../widgets/families/catalog.js";

import {
  clampIndex,
  familyAccent,
  type PickerBasis,
  widgetsInFamily,
  windowSlice,
} from "./picker-helpers.js";
import { previewWidget } from "../preview/preview-fixture.js";

export interface PickerWidgetProps extends PickerBasis {
  readonly family: WidgetFamily;
  readonly entries: readonly WidgetMetaEntry[];
  readonly query: string;
  readonly highlight: number;
  /** Widget types already placed elsewhere — hidden from the list. */
  readonly exclude?: ReadonlySet<string>;
  /** Lower-level translator for catalogue-driven ids (`widget.<type>.desc`). */
  readonly t?: Translator;
  /** Dictionary-bound translator for static-id chrome. */
  readonly td?: DictTranslator;
}

export function PickerWidget(props: PickerWidgetProps): React.ReactElement {
  const t = props.t ?? identityTranslator;
  const td = props.td ?? createDictTranslator({});
  const config = props.config ?? DEFAULT_CONFIG;
  const theme = props.theme ?? null;
  const env = props.env ?? {};
  const exclude = props.exclude ?? new Set<string>();
  const matches = widgetsInFamily(props.entries, props.family, props.query, exclude);
  const highlight = clampIndex(props.highlight, matches.length);
  const { start, rows } = windowSlice(matches, highlight);
  const widestType = rows.reduce((n, e) => Math.max(n, e.type.length), 0);
  /*
   * Pad preview text so descriptions line up in their own column. Capture
   * `fg` from the cell so self-hiding widgets still render with their family
   * accent colour (via the glyph-prefixed label the fixture now returns).
   */
  const previews = rows.map((e) => {
    const cell = previewWidget(e.type, undefined, { config, theme, env });
    return { text: cell.text || e.type, fg: cell.fg };
  });
  const widestPreview = previews.reduce((n, p) => Math.max(n, p.text.length), 0);
  const countLabel = td("picker.match-count", {
    n: matches.length,
    es: matches.length === 1 ? "" : "es",
  });
  const accent = familyAccent(props.family, config, env);

  const body =
    matches.length === 0
      ? [
          React.createElement(Text, { key: "none", dimColor: true }, td("picker.no-match")),
        ]
      : rows.map((e, i) => {
          const idx = start + i;
          const selected = idx === highlight;
          const preview = previews[i] ?? { text: "", fg: undefined };
          const head = `  ${selected ? "▸ " : "  "}${e.type.padEnd(widestType, " ")}`;
          return React.createElement(
            Box,
            { key: e.type, flexDirection: "row" },
            React.createElement(Text, { color: accent, bold: selected }, head),
            React.createElement(
              Text,
              { color: preview.fg },
              `  ${preview.text.padEnd(widestPreview, " ")}`,
            ),
            React.createElement(
              Text,
              { dimColor: true },
              `  ${t(widgetDescId(e.type), e.description)}`,
            ),
          );
        });

  return React.createElement(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 1,
      marginTop: 1,
    },
    React.createElement(
      Text,
      { bold: true },
      td("picker.widget.title"),
      React.createElement(Text, { color: accent, bold: true }, `‹${props.family}›`),
    ),
    React.createElement(Text, null, `${td("picker.filter")}: ${props.query}▏`),
    React.createElement(Text, { dimColor: true }, td("picker.widget.hint", { c: countLabel })),
    ...body,
  );
}
