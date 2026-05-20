import { promises as fs } from "node:fs";

/**
 * Returns `true` when `path` is accessible; `false` otherwise.
 * Never throws — wraps `fs.access` and swallows the error.
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/** Detect a missing-file error (`ENOENT`) regardless of throw shape. */
export function isEnoent(err: unknown): boolean {
  return errorCode(err) === "ENOENT";
}

/** Detect a file-exists error (`EEXIST`); raised by `fs.open(path, "wx")`. */
export function isEexist(err: unknown): boolean {
  return errorCode(err) === "EEXIST";
}

function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  if (!("code" in err)) return undefined;
  const code = (err as { code: unknown }).code;
  return typeof code === "string" ? code : undefined;
}
