/**
 * Picker step 1c — flat, searchable list across every catalogued widget.
 * Entered from `PickerGroup` via `/`. Each row carries a family-accent
 * badge.
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
import type { WidgetMetaEntry } from "../../widgets/families/catalog.js";

import {
  clampIndex,
  familyAccent,
  filterWidgets,
  type PickerBasis,
  windowSlice,
} from "./picker-helpers.js";
import { previewWidget } from "../preview/preview-fixture.js";

export interface PickerSearchProps extends PickerBasis {
  readonly entries: readonly WidgetMetaEntry[];
  readonly query: string;
  readonly highlight: number;
  /** Widget types already placed elsewhere — hidden from the list. */
  readonly exclude?: ReadonlySet<string>;
  /** Lower-level translator used for catalogue-driven ids (`widget.<type>.desc`). */
  readonly t?: Translator;
  /** Dictionary-bound translator for static-id chrome. */
  readonly td?: DictTranslator;
}

export function PickerSearch(props: PickerSearchProps): React.ReactElement {
  const t = props.t ?? identityTranslator;
  const td = props.td ?? createDictTranslator({});
  const config = props.config ?? DEFAULT_CONFIG;
  const theme = props.theme ?? null;
  const env = props.env ?? {};
  const exclude = props.exclude ?? new Set<string>();
  const matches = filterWidgets(props.entries, props.query, exclude);
  const highlight = clampIndex(props.highlight, matches.length);
  const { start, rows } = windowSlice(matches, highlight);
  const widestType = rows.reduce((n, e) => Math.max(n, e.type.length), 0);
  const previews = rows.map((e) => {
    const cell = previewWidget(e.type, undefined, { config, theme, env });
    return { text: cell.text || e.type, fg: cell.fg };
  });
  const widestPreview = previews.reduce((n, p) => Math.max(n, p.text.length), 0);
  const querying = props.query.length > 0;
  const countLabel = querying
    ? td("picker.match-count", {
        n: matches.length,
        es: matches.length === 1 ? "" : "es",
      })
    : td("picker.widget-count", {
        n: matches.length,
        s: matches.length === 1 ? "" : "s",
      });
  const footerHint = querying
    ? td("picker.search.hint-querying", { c: countLabel })
    : td("picker.search.hint", { c: countLabel });

  const allExcluded = exclude.size > 0 && exclude.size >= props.entries.length;
  const emptyMessage =
    !querying && allExcluded ? td("picker.all-placed") : td("picker.no-match");

  const body =
    matches.length === 0
      ? [React.createElement(Text, { key: "none", dimColor: true }, emptyMessage)]
      : rows.map((e, i) => {
          const idx = start + i;
          const selected = idx === highlight;
          const preview = previews[i] ?? { text: "", fg: undefined };
          const accent = familyAccent(e.family, config, env);
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
    React.createElement(Text, { bold: true }, td("picker.search.title")),
    React.createElement(Text, null, `${td("picker.search")}: ${props.query}▏`),
    React.createElement(Text, { dimColor: true }, footerHint),
    ...body,
  );
}
