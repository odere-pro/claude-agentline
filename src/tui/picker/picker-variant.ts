/**
 * Picker final step — pick a variant for widgets that carry them.
 * Skipped automatically for widgets with no variants.
 */

import { Box, Text } from "ink";
import React from "react";

import {
  createDictTranslator,
  identityTranslator,
  widgetVariantId,
  type DictTranslator,
  type Translator,
} from "../../core/i18n/index.js";
import { DEFAULT_CONFIG } from "../../data/config/defaults/defaults.js";
import { widgetMeta } from "../../widgets/families/catalog.js";

import {
  clampIndex,
  familyAccent,
  previewForVariant,
  type PickerBasis,
  variantRows,
  type VariantRow,
} from "./picker-helpers.js";

export interface PickerVariantProps extends PickerBasis {
  readonly widgetType: string;
  /** `"update"` shows "Keep current"; `"fresh"` (insert/replace) shows "Default options". */
  readonly mode: "update" | "fresh";
  readonly highlight: number;
  /** Lower-level translator for catalogue-driven variant ids. */
  readonly t?: Translator;
  /** Dictionary-bound translator for static-id chrome. */
  readonly td?: DictTranslator;
}

export function PickerVariant(props: PickerVariantProps): React.ReactElement {
  const t = props.t ?? identityTranslator;
  const td = props.td ?? createDictTranslator({});
  const config = props.config ?? DEFAULT_CONFIG;
  const theme = props.theme ?? null;
  const env = props.env ?? {};
  const rows = variantRows(props.widgetType, props.mode);
  const highlight = clampIndex(props.highlight, rows.length);
  const syntheticId = props.mode === "update" ? "picker.variant.keep" : "picker.variant.default";
  const rowLabel = (row: VariantRow): string =>
    row.id === null
      ? td(syntheticId)
      : t(widgetVariantId(props.widgetType, row.id), row.label);
  const widest = rows.reduce((n, r) => Math.max(n, rowLabel(r).length), 0);
  const meta = widgetMeta(props.widgetType);
  const accent = meta ? familyAccent(meta.family, config, env) : undefined;
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
      td("picker.variant.title", { type: props.widgetType }),
    ),
    React.createElement(Text, { dimColor: true }, td("picker.variant.hint")),
    ...rows.map((row, idx) => {
      const selected = idx === highlight;
      const preview = previewForVariant(props.widgetType, row, config, theme, env);
      return React.createElement(
        Box,
        { key: row.id ?? "__default__", flexDirection: "row" },
        React.createElement(
          Text,
          { color: accent, bold: selected },
          `  ${selected ? "▸ " : "  "}${rowLabel(row).padEnd(widest, " ")}  `,
        ),
        React.createElement(Text, { color: accent, bold: selected }, preview),
      );
    }),
  );
}
