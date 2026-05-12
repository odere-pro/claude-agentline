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
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "ENOENT"
  );
}
