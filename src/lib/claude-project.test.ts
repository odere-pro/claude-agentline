import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isClaudeProject, projectGate } from "./claude-project.js";

describe("isClaudeProject", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-claude-project-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("recognises a directory with a .claude/ subdirectory", async () => {
    mkdirSync(join(tmp, ".claude"));
    await expect(isClaudeProject(tmp)).resolves.toBe(true);
  });

  it("recognises a directory with a CLAUDE.md file", async () => {
    writeFileSync(join(tmp, "CLAUDE.md"), "# briefing");
    await expect(isClaudeProject(tmp)).resolves.toBe(true);
  });

  it("recognises a directory with both markers", async () => {
    mkdirSync(join(tmp, ".claude"));
    writeFileSync(join(tmp, "CLAUDE.md"), "");
    await expect(isClaudeProject(tmp)).resolves.toBe(true);
  });

  it("rejects a bare directory", async () => {
    await expect(isClaudeProject(tmp)).resolves.toBe(false);
  });

  it("does not match a directory named CLAUDE.md or a file named .claude (filesystem-level only)", async () => {
    // .claude is checked via fs.access — a file *named* `.claude` still
    // passes pathExists, so we don't try to distinguish file from dir
    // here. This test pins the behaviour: any entry called `.claude`
    // counts. Documenting current semantics, not aspirational ones.
    writeFileSync(join(tmp, ".claude"), "not a directory");
    await expect(isClaudeProject(tmp)).resolves.toBe(true);
  });
});

describe("projectGate", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-gate-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns "proceed" inside a Claude project without prompting', async () => {
    mkdirSync(join(tmp, ".claude"));
    const writes: string[] = [];
    const stderr = { write: (s: string) => writes.push(s) };
    const result = await projectGate({
      cwd: tmp,
      stdin: makeTtyStream(""),
      stderr,
      command: "edit",
    });
    expect(result).toBe("proceed");
    expect(writes).toHaveLength(0);
  });

  it('returns "skip" silently on a non-TTY stdin outside a Claude project', async () => {
    const writes: string[] = [];
    const stderr = { write: (s: string) => writes.push(s) };
    const stdin = new PassThrough() as NodeJS.ReadableStream & { isTTY?: boolean };
    stdin.isTTY = false;
    const result = await projectGate({
      cwd: tmp,
      stdin,
      stderr,
      command: "init",
    });
    expect(result).toBe("skip");
    expect(writes).toEqual([]);
  });

  it('returns "proceed" on TTY when the user answers "y"', async () => {
    const writes: string[] = [];
    const stderr = { write: (s: string) => writes.push(s) };
    const stdin = makeTtyStream("y\n");
    const result = await projectGate({
      cwd: tmp,
      stdin,
      stderr,
      command: "install",
    });
    expect(result).toBe("proceed");
    // No "Skipped" footer.
    expect(writes.join("")).not.toContain("Skipped");
  });

  it('returns "skip" on TTY when the user answers "n" (and emits the Skipped footer)', async () => {
    const writes: string[] = [];
    const stderr = { write: (s: string) => writes.push(s) };
    const stdin = makeTtyStream("n\n");
    const result = await projectGate({
      cwd: tmp,
      stdin,
      stderr,
      command: "edit",
    });
    expect(result).toBe("skip");
    expect(writes.join("")).toContain("Skipped — not a Claude project.");
  });

  it('treats an empty answer as default "N"', async () => {
    const writes: string[] = [];
    const stderr = { write: (s: string) => writes.push(s) };
    const stdin = makeTtyStream("\n");
    const result = await projectGate({
      cwd: tmp,
      stdin,
      stderr,
      command: "edit",
    });
    expect(result).toBe("skip");
  });
});

/** Build a PassThrough that masquerades as a TTY and pre-loads `payload`. */
function makeTtyStream(payload: string): NodeJS.ReadableStream & { isTTY?: boolean } {
  const stream = new PassThrough() as NodeJS.ReadableStream & { isTTY?: boolean };
  stream.isTTY = true;
  if (payload.length > 0) (stream as PassThrough).end(payload);
  return stream;
}
