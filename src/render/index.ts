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

export {
  detectTerminalWidth,
  applyWidthMode,
  FALLBACK_WIDTH,
  DEFAULT_COMPACT_THRESHOLD,
  type AppliedWidth,
  type WidthMode,
  type WidthModeOptions,
  type WidthSource,
} from "./width.js";

export {
  detectColourDepth,
  type ColourDepth,
  type ColourDepthSource,
} from "./colour-depth.js";

export { encodeSegments, SGR_RESET } from "./ansi.js";
export { plainSegment, type Segment } from "./segment.js";

export {
  parseAccessibilityArgs,
  honourNoColorEnv,
  effectiveDepth,
  applyAccessibility,
  stripNonAscii,
  type AccessibilityFlags,
} from "./accessibility.js";

export { writeOnce, type WritableLike } from "./write.js";

export { composeLines, type ComposeOptions } from "./compose.js";

import { encodeSegments } from "./ansi.js";
import {
  applyAccessibility,
  effectiveDepth,
  type AccessibilityFlags,
} from "./accessibility.js";
import type { ColourDepth } from "./colour-depth.js";
import type { Segment } from "./segment.js";

export interface RenderLineOptions {
  readonly depth: ColourDepth;
  readonly flags: AccessibilityFlags;
}

export function renderLine(
  segments: readonly Segment[],
  options: RenderLineOptions,
): string {
  const accessible = applyAccessibility(segments, options.flags);
  const depth = effectiveDepth(options.depth, options.flags);
  return encodeSegments(accessible, depth);
}
