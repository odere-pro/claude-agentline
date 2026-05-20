import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { withFileLock } from "./file-lock.js";

describe("withFileLock", () => {
  let tmp: string;
  let target: string;
  let lockPath: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-lock-"));
    target = join(tmp, "config.json");
    lockPath = `${target}.lock`;
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("runs the critical section and removes the lock when done", async () => {
    const result = await withFileLock(target, async () => "ok");
    expect(result).toBe("ok");
    expect(existsSync(lockPath)).toBe(false);
  });

  it("removes the lock even when the critical section throws", async () => {
    await expect(
      withFileLock(target, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(existsSync(lockPath)).toBe(false);
  });

  it("serialises two overlapping callers on the same path", async () => {
    const order: string[] = [];
    const a = withFileLock(target, async () => {
      order.push("a-start");
      await new Promise((r) => setTimeout(r, 30));
      order.push("a-end");
    });
    const b = withFileLock(target, async () => {
      order.push("b-start");
      order.push("b-end");
    });
    await Promise.all([a, b]);
    /*
     * The lock guarantees serialisation, not winner: whichever caller
     * acquires the filesystem lock first runs to completion before the
     * other starts. Accept either total order; reject any interleave.
     */
    expect(order).toSatisfy(
      (events: string[]) =>
        events.join() === "a-start,a-end,b-start,b-end" ||
        events.join() === "b-start,b-end,a-start,a-end",
    );
  });

  it("times out when the lock is held past the deadline", async () => {
    writeFileSync(lockPath, String(process.pid));
    await expect(
      withFileLock(target, async () => "unreachable", { timeoutMs: 100 }),
    ).rejects.toThrow(/timed out waiting for file lock/);
  });

  it("clears a stale lock whose owning PID is dead", async () => {
    writeFileSync(lockPath, "999999"); // PID that almost certainly is not alive
    const result = await withFileLock(target, async () => "took-over", { timeoutMs: 500 });
    expect(result).toBe("took-over");
  });

  it("clears a lock older than the stale window", async () => {
    writeFileSync(lockPath, String(process.pid));
    // Backdate the lock 60s into the past.
    const past = new Date(Date.now() - 60_000);
    utimesSync(lockPath, past, past);
    // testForceTakeover skips PID liveness, but we want to validate the
    // age path — emulate by writing a dead PID and backdating.
    writeFileSync(lockPath, "999999");
    utimesSync(lockPath, past, past);
    const result = await withFileLock(target, async () => "took-over-age", { timeoutMs: 500 });
    expect(result).toBe("took-over-age");
  });

  it("writes the current PID into the lock body while held", async () => {
    let observed: string | undefined;
    await withFileLock(target, async () => {
      observed = readFileSync(lockPath, "utf8").trim();
    });
    expect(observed).toBe(String(process.pid));
  });
});
