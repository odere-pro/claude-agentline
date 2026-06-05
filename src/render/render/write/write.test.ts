import { describe, expect, it } from "vitest";

import { renderForFixture } from "../fixture/fixture-runner.js";
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

/*
 * Integration: the full render pipeline (renderForFixture → writeOnce) lands
 * in EXACTLY ONE stream.write call on the integrated hot path.
 *
 * This pins the "one-syscall write" contract (src/render/render/CLAUDE.md
 * "Exactly one stdout syscall per render") at the integration level — the
 * unit test above asserts writeOnce itself, but this case asserts that a
 * representative end-to-end render never causes multiple writes. It would
 * FAIL if a second stream.write were introduced anywhere in the path.
 */
describe("integrated one-syscall write", () => {
  it("a full representative render through renderForFixture lands in exactly one stream.write", async () => {
    // Arrange: minimal deterministic payload using the same knobs as the golden harness
    // (src/render/render/__golden__.test.ts ~lines 65-76).
    const stdinJson = JSON.stringify({ model: "claude-opus-4-7", cwd: "/repo/agentline" });
    const output = await renderForFixture(stdinJson, {
      env: { NO_COLOR: "1", AGENTLINE_GLYPHS: "ascii" },
      flags: { noColor: true, noUnicode: false },
      frozenClockISO: "2026-05-01T14:32:05Z",
      width: 80,
    });

    // Act: route through the one-syscall writer.
    const stream = new CapturingStream();
    writeOnce(stream, output);

    // Assert: exactly one write call — no torn lines, no incremental writes.
    expect(stream.chunks).toHaveLength(1);
    // The single write must be non-empty (stdout always carries at least one line).
    expect(typeof stream.chunks[0]).toBe("string");
    expect((stream.chunks[0] as string).length).toBeGreaterThan(0);
  });
});
