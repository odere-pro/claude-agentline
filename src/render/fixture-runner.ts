/**
 * Tiny in-process render replay used by the doctor's D10 check.
 *
 * The full render pipeline is owned by a downstream PR; this stub runs the
 * same shape the default `src/cli.ts` path uses so doctor has something
 * concrete to verify today. When the real pipeline lands the implementation
 * here is replaced (the public API stays).
 */

import { Readable } from "node:stream";
import { readStdinPayload } from "../stdin/index.js";

export async function renderForFixture(stdinJson: string): Promise<string> {
  const stream = Readable.from([Buffer.from(stdinJson, "utf8")]);
  const payload = await readStdinPayload(stream);
  const model = payload.model ?? "claude";
  const cwdLabel = payload.cwd ? ` · ${payload.cwd}` : "";
  return `${model}${cwdLabel}\n`;
}
