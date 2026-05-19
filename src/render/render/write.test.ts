import { describe, expect, it } from "vitest";

import { writeOnce, type WritableLike } from "./write.js";

class CapturingStream implements WritableLike {
  public readonly chunks: (string | Buffer)[] = [];
  write(buffer: Buffer | string): boolean {
    this.chunks.push(buffer);
    return true;
  }
}

describe("writeOnce", () => {
  it("writes the output in a single call", () => {
    const stream = new CapturingStream();
    writeOnce(stream, "hello");
    expect(stream.chunks).toHaveLength(1);
    expect(stream.chunks[0]).toBe("hello\n");
  });

  it("does not double-up an existing trailing newline", () => {
    const stream = new CapturingStream();
    writeOnce(stream, "hello\n");
    expect(stream.chunks[0]).toBe("hello\n");
  });
});
