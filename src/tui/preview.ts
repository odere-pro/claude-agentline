/**
 * Live-preview region for the `agentline config` TUI editor.
 *
 * Renders what the statusline would look like with the editor's current
 * line list, using the synthetic demo session (`src/render/demo-fixture.ts`)
 * — same code path the real renderer takes (`renderFromInputs`), so the
 * preview is faithful. Pure UI: it takes the loaded config as a base, swaps
 * in the editor's `lines`, and shows the rendered string row by row.
 *
 * Imported only from the lazily-loaded TUI bundle, so the render hot path
 * picks up nothing from here.
 */

import { Box, Text } from "ink";
import React from "react";

import type { AgentlineConfig, LineConfig } from "../config/types.js";
import { previewStatusline } from "../render/demo-fixture.js";
import type { Theme } from "../theme/index.js";

export interface PreviewProps {
  /** The full loaded config — everything except `lines` is taken from here. */
  readonly base: AgentlineConfig;
  /** The editor's current (mutable) line list. */
  readonly lines: readonly LineConfig[];
  /** Terminal width to compose against; defaults to a roomy 120. */
  readonly width?: number;
  /**
   * Resolved theme to colour the preview with. The editor resolves
   * `base.theme` once at startup and threads it through; pass `null` (the
   * default) to render uncoloured.
   */
  readonly theme?: Theme | null;
}

/** Compose the preview string for the given edit state. */
export function previewLines(props: PreviewProps): readonly string[] {
  const config: AgentlineConfig = {
    ...props.base,
    lines: props.lines.map((line) => ({ widgets: line.widgets.map((w) => ({ ...w })) })),
  };
  const opts = {
    ...(props.width !== undefined ? { width: props.width } : {}),
    ...(props.theme !== undefined ? { theme: props.theme } : {}),
    // The preview ought to look like the real bin in this terminal; pass
    // `process.env` so colour-depth and glyph-support detection match the
    // user's host. Single-Cell previews keep the deterministic `env: {}`
    // default in `demoRenderInputs`.
    env: process.env,
  };
  // `renderFromInputs` joins the rendered lines with "\n" and appends a
  // trailing newline; drop it so an N-line config yields exactly N rows.
  // An all-empty config still yields one (empty) row to keep the box height
  // stable.
  const rendered = previewStatusline(config, opts).replace(/\n$/, "");
  const rows = rendered.split("\n");
  return rows.length > 0 ? rows : [""];
}

export function Preview(props: PreviewProps): React.ReactElement {
  const rows = previewLines(props);
  return React.createElement(
    Box,
    { flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1 },
    React.createElement(Text, { dimColor: true }, "preview (demo session)"),
    ...rows.map((row, i) =>
      React.createElement(Text, { key: `row${i}`, wrap: "truncate-end" }, row.length > 0 ? row : " "),
    ),
  );
}
