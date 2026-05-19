/**
 * Per-model context window sizes (in tokens). Used by `context-*`
 * widgets to compute used / window ratio. Unknown models default to
 * 200 000 — the standard Sonnet/Opus window — which keeps the
 * percentage roughly meaningful instead of dividing by undefined.
 */

const WINDOWS: ReadonlyMap<string, number> = new Map([
  ["claude-opus-4-7", 200_000],
  ["claude-opus-4-7[1m]", 1_000_000],
  ["claude-sonnet-4-6", 200_000],
  ["claude-haiku-4-5", 200_000],
  ["claude-haiku-4-5-20251001", 200_000],
]);

const DEFAULT_WINDOW = 200_000;

export function contextWindowFor(modelId: string | undefined): number {
  if (!modelId) return DEFAULT_WINDOW;
  return WINDOWS.get(modelId) ?? matchByPrefix(modelId);
}

function matchByPrefix(modelId: string): number {
  if (modelId.includes("[1m]")) return 1_000_000;
  if (modelId.startsWith("claude-")) return DEFAULT_WINDOW;
  return DEFAULT_WINDOW;
}
