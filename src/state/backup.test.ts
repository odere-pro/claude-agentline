import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  STATUS_LINE_BACKUP_VERSION,
  deleteStatusLineBackup,
  readStatusLineBackup,
  resolveBackupPaths,
  saveStatusLineBackup,
} from "./backup.js";

describe("resolveBackupPaths", () => {
  it("treats CLAUDE_CONFIG_DIR as the agentline dir (shell-compatible)", () => {
    const paths = resolveBackupPaths({ CLAUDE_CONFIG_DIR: "/etc/x" });
    expect(paths.backupFile).toBe("/etc/x/state/settings-backup.json");
    expect(paths.stateDir).toBe("/etc/x/state");
  });

  it("falls back to ~/.config/agentline when CLAUDE_CONFIG_DIR is unset", () => {
    const paths = resolveBackupPaths({});
    expect(paths.backupFile).toMatch(/[/\\]\.config[/\\]agentline[/\\]state[/\\]settings-backup\.json$/);
  });
});

describe("saveStatusLineBackup / readStatusLineBackup", () => {
  let tmp: string;
  let backupFile: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-backup-"));
    backupFile = join(tmp, "settings-backup.json");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("writes a backup with the present-with-string-value path", async () => {
    const result = await saveStatusLineBackup({
      previousStatusLine: { type: "command", command: "/bin/echo hi" },
      previousStatusLinePresent: true,
      backupFile,
      clock: () => new Date("2026-05-04T01:00:00Z"),
    });
    expect(result).toBe("created");
    const written = JSON.parse(readFileSync(backupFile, "utf8"));
    expect(written.version).toBe(STATUS_LINE_BACKUP_VERSION);
    expect(written.previousStatusLinePresent).toBe(true);
    expect(written.previousStatusLine).toEqual({ type: "command", command: "/bin/echo hi" });
    expect(written.createdAt).toBe("2026-05-04T01:00:00.000Z");
  });

  it("writes a backup with the absent-key path", async () => {
    const result = await saveStatusLineBackup({
      previousStatusLine: undefined,
      previousStatusLinePresent: false,
      backupFile,
    });
    expect(result).toBe("created");
    const written = JSON.parse(readFileSync(backupFile, "utf8"));
    expect(written.previousStatusLinePresent).toBe(false);
  });

  it("refuses to overwrite an existing backup (first install wins)", async () => {
    await saveStatusLineBackup({
      previousStatusLine: "first",
      previousStatusLinePresent: true,
      backupFile,
    });
    const second = await saveStatusLineBackup({
      previousStatusLine: "second",
      previousStatusLinePresent: true,
      backupFile,
    });
    expect(second).toBe("skipped");
    const written = JSON.parse(readFileSync(backupFile, "utf8"));
    expect(written.previousStatusLine).toBe("first");
  });

  it("readStatusLineBackup returns null when the backup is absent", async () => {
    expect(await readStatusLineBackup({ backupFile })).toBeNull();
  });

  it("readStatusLineBackup round-trips a saved backup", async () => {
    await saveStatusLineBackup({
      previousStatusLine: "/bin/echo hi",
      previousStatusLinePresent: true,
      backupFile,
    });
    const read = await readStatusLineBackup({ backupFile });
    expect(read).not.toBeNull();
    expect(read!.previousStatusLine).toBe("/bin/echo hi");
    expect(read!.previousStatusLinePresent).toBe(true);
  });

  it("readStatusLineBackup throws on malformed JSON", async () => {
    mkdirSync(tmp, { recursive: true });
    writeFileSync(backupFile, "{ not json");
    await expect(readStatusLineBackup({ backupFile })).rejects.toThrow(/not valid JSON/);
  });

  it("readStatusLineBackup throws on version mismatch", async () => {
    mkdirSync(tmp, { recursive: true });
    writeFileSync(
      backupFile,
      JSON.stringify({
        version: 999,
        createdAt: "x",
        agentlineVersion: "x",
        previousStatusLinePresent: true,
        previousStatusLine: "x",
      }),
    );
    await expect(readStatusLineBackup({ backupFile })).rejects.toThrow(/unsupported version/);
  });
});

describe("deleteStatusLineBackup", () => {
  let tmp: string;
  let backupFile: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-backup-del-"));
    backupFile = join(tmp, "settings-backup.json");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("removes the backup file when present", async () => {
    await saveStatusLineBackup({
      previousStatusLine: "x",
      previousStatusLinePresent: true,
      backupFile,
    });
    await deleteStatusLineBackup({ backupFile });
    expect(await readStatusLineBackup({ backupFile })).toBeNull();
  });

  it("is a no-op when the file does not exist", async () => {
    await expect(deleteStatusLineBackup({ backupFile })).resolves.toBeUndefined();
  });
});
