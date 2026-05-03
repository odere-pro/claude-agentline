/**
 * Best-effort detection of Nerd Font availability (§5.1).
 *
 * The bin can never *prove* a Nerd Font is installed at the host
 * level — that's doctor's D05 check. This helper is the render-path
 * heuristic that decides whether to ship Nerd Font triangles or the
 * ASCII fallback at runtime:
 *
 *   - explicit env override `AGENTLINE_GLYPHS=ascii` ⇒ ASCII
 *   - explicit env override `AGENTLINE_GLYPHS=nerd`  ⇒ Nerd Font
 *   - accessibility flag `--ascii` already collapsed by the caller
 *     into the env-driven detection upstream
 *   - default                                      ⇒ Nerd Font
 *
 * No filesystem reads, no font enumeration, no shell-outs.
 */

export type GlyphSupport = "nerd" | "ascii";

export function detectGlyphSupport(env: NodeJS.ProcessEnv): GlyphSupport {
  const explicit = env["AGENTLINE_GLYPHS"]?.toLowerCase();
  if (explicit === "ascii") return "ascii";
  if (explicit === "nerd" || explicit === "unicode") return "nerd";
  return "nerd";
}
