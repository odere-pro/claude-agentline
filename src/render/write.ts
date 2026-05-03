/**
 * One-syscall stdout writer (§8.2 step 5).
 *
 * The renderer accumulates the entire frame into one buffer so the
 * host terminal sees an atomic update — no torn lines from interleaved
 * writes. The trailing newline is appended here so callers don't need
 * to think about it.
 */

export interface WritableLike {
  write(buffer: Buffer | string): boolean;
}

export function writeOnce(stream: WritableLike, output: string): void {
  const trailing = output.endsWith("\n") ? "" : "\n";
  stream.write(`${output}${trailing}`);
}
