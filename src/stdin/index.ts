/**
 * Claude Code statusline stdin contract parser.
 *
 * The bin reads stdin until EOF or 256 KB, whichever first (§8.1).
 * Unknown fields are preserved untouched on `raw`. A malformed payload
 * produces a structured error the caller can render as an ASCII fallback.
 */

const MAX_PAYLOAD_BYTES = 256 * 1024;

export interface StdinPayload {
  /** Original parsed JSON, fields untouched. */
  raw: Record<string, unknown>;
  /** True when the payload was clipped at MAX_PAYLOAD_BYTES. */
  truncated: boolean;
  /** Convenience accessors for known fields; all optional. */
  model?: string;
  version?: string;
  outputStyle?: string;
  sessionId?: string;
  sessionName?: string;
  cwd?: string;
  thinkingEffort?: string;
  vimMode?: string;
  transcriptPath?: string;
}

export class StdinParseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "StdinParseError";
  }
}

export async function readStdinPayload(stream: NodeJS.ReadableStream): Promise<StdinPayload> {
  const buf = await readBounded(stream, MAX_PAYLOAD_BYTES);
  if (buf.byteLength === 0) {
    return { raw: {}, truncated: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(buf.toString("utf8"));
  } catch (err) {
    throw new StdinParseError("invalid stdin JSON", err);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new StdinParseError("stdin payload must be a JSON object");
  }
  const raw = parsed as Record<string, unknown>;
  return {
    raw,
    truncated: buf.byteLength === MAX_PAYLOAD_BYTES,
    model: pickString(raw, "model"),
    version: pickString(raw, "version"),
    outputStyle: pickString(raw, "outputStyle"),
    sessionId: pickString(raw, "sessionId"),
    sessionName: pickString(raw, "sessionName"),
    cwd: pickString(raw, "cwd"),
    thinkingEffort: pickString(raw, "thinkingEffort"),
    vimMode: pickString(raw, "vimMode"),
    transcriptPath: pickString(raw, "transcriptPath"),
  };
}

function pickString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

async function readBounded(stream: NodeJS.ReadableStream, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    const remaining = limit - total;
    if (buf.byteLength >= remaining) {
      chunks.push(buf.subarray(0, remaining));
      total = limit;
      break;
    }
    chunks.push(buf);
    total += buf.byteLength;
  }
  return Buffer.concat(chunks, total);
}
