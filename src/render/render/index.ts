/**
 * Render pipeline entry point (§8.2).
 *
 * PR 8 ships the foundation: width detection, colour-depth detection,
 * accessibility fallbacks, the ANSI encoder, and the one-syscall
 * writer. Widget composition, Powerline transform, and flex-separator
 * expansion arrive in PRs 9–15; this module deliberately exposes a
 * minimal `renderLine` helper that callers can compose against
 * before the widget surface lands.
 */

export type { Segment } from "./segment/segment.js";

import { encodeSegments } from "./ansi/ansi.js";
import { applyAccessibility, effectiveDepth, type AccessibilityFlags } from "./accessibility/accessibility.js";
import type { ColourDepth } from "./colour-depth/colour-depth.js";
import type { Segment } from "./segment/segment.js";

export interface RenderLineOptions {
  readonly depth: ColourDepth;
  readonly flags: AccessibilityFlags;
}

export function renderLine(segments: readonly Segment[], options: RenderLineOptions): string {
  const accessible = applyAccessibility(segments, options.flags);
  const depth = effectiveDepth(options.depth, options.flags);
  return encodeSegments(accessible, depth);
}
