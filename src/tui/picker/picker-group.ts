/**
 * Picker step 1a — pick a widget family (the default view when the
 * picker opens). `/` switches to `PickerSearch`; ↵ on a family advances
 * to `PickerWidget` for that family.
 */

import { Box, Text } from "ink";
import React from "react";

import {
  createDictTranslator,
  identityTranslator,
  type DictTranslator,
  type Translator,
} from "../../core/i18n/index.js";
import { DEFAULT_CONFIG } from "../../data/config/defaults/defaults.js";
import type { WidgetMetaEntry } from "../../widgets/families/catalog.js";

import type { EditorGlyphs } from "../tui/glyphs/glyphs.js";
import {
  clampIndex,
  familiesWithWidgets,
  familyAccent,
  type PickerBasis,
} from "./picker-helpers.js";

export interface PickerGroupProps extends PickerBasis {
  readonly title?: string;
  readonly entries: readonly WidgetMetaEntry[];
  readonly highlight: number;
  readonly glyphs: EditorGlyphs;
  /** Widget types already placed elsewhere — they don't count toward
   *  per-group totals and groups that become empty are hidden. */
  readonly exclude?: ReadonlySet<string>;
  /** Lower-level translator for template-literal ids (`family.<name>.name`). */
  readonly t?: Translator;
  /** Dictionary-bound translator for static-id chrome. */
  readonly td?: DictTranslator;
}

export function PickerGroup(props: PickerGroupProps): React.ReactElement {
  const t = props.t ?? identityTranslator;
  const td = props.td ?? createDictTranslator({});
  const config = props.config ?? DEFAULT_CONFIG;
  const env = props.env ?? {};
  const exclude = props.exclude ?? new Set<string>();
  const cats = familiesWithWidgets(props.entries, exclude);
  const highlight = clampIndex(props.highlight, cats.length);
  const widestName = cats.reduce((n, c) => Math.max(n, c.length), 0);
  const counts = cats.map(
    (cat) => props.entries.filter((e) => e.family === cat && !exclude.has(e.type)).length,
  );
  const widestCount = counts.reduce((n, c) => Math.max(n, String(c).length), 1);
  /*
   * Box-per-column layout: family icons differ in terminal cell-width
   * (some fonts render `⚙` as two cells, others as one), and counts vary
   * between one and two digits. Painting each column into its own
   * `Box` with an explicit `width` lets Yoga handle the cell math so
   * the name and count columns line up regardless of glyph or count
   * width.
   */
  const MARKER_WIDTH = 2;
  const ICON_WIDTH = 3;
  const COLUMN_GAP = 2;
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
      props.title ?? td("picker.group.title"),
    ),
    React.createElement(
      Text,
      { dimColor: true },
      td("picker.group.hint", {
        n: cats.length,
        s: cats.length === 1 ? "" : "s",
      }),
    ),
    ...cats.map((cat, idx) => {
      const selected = idx === highlight;
      const count = counts[idx] ?? 0;
      const icon = props.glyphs.family[cat] ?? " ";
      const accent = familyAccent(cat, config, env);
      return React.createElement(
        Box,
        { key: cat, flexDirection: "row" },
        React.createElement(
          Box,
          { width: MARKER_WIDTH, flexShrink: 0 },
          React.createElement(Text, { color: accent, bold: selected }, selected ? "▸ " : "  "),
        ),
        React.createElement(
          Box,
          { width: ICON_WIDTH, flexShrink: 0 },
          React.createElement(Text, { color: accent }, icon),
        ),
        React.createElement(
          Box,
          { width: widestName + COLUMN_GAP, flexShrink: 0 },
          React.createElement(
            Text,
            { color: accent, bold: selected },
            t(`family.${cat}.name`, cat),
          ),
        ),
        React.createElement(
          Box,
          { width: widestCount, flexShrink: 0, justifyContent: "flex-end" },
          React.createElement(Text, { dimColor: true }, String(count)),
        ),
        React.createElement(
          Text,
          { dimColor: true },
          td("picker.group.widgets-suffix", { s: count === 1 ? "" : "s" }),
        ),
      );
    }),
  );
}
