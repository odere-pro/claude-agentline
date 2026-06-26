/**
 * Single source of truth for the bin's reported version.
 * Kept independent of package.json reads so the bundled output
 * has no runtime fs dependency on its own manifest.
 */
export const AGENTLINE_VERSION = "1.2.0";
