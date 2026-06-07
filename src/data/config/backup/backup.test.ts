/**
 * Tests for the config-backup helper (single-slot `config.json.bak`).
 *
 * This is the rollback substrate for `agentline config undo`. Every
 * config-writing path backs up the prior config bytes here BEFORE the new
 * config lands, through the one atomic-write helper. `undo` restores it.
 *
 * Single-level: one `.bak` slot, last-write-wins. Not a multi-level
 * history. Distinct from the host-statusLine `settings-backup.json`.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { withTmpDir } from "../../../test-helpers/index.js";
import {
  backupAndWriteConfig,
  configBackupPath,
  readConfigBackup,
  restoreConfigBackup,
} from "./backup.js";

const A = { version: 1, lines: [{ widgets: [{ type: "model" }] }] };
const B = { version: 1, lines: [{ widgets: [{ type: "version" }] }] };

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path, "utf8"));
}

describe("configBackupPath", () => {
  it("is the config path with a .bak suffix", () => {
    expect(configBackupPath("/cfg/agentline/config.json")).toBe(
      "/cfg/agentline/config.json.bak",
    );
  });
});

describe("backupAndWriteConfig", () => {
  it("writes the new config and leaves no backup when none existed before", async () => {
    await withTmpDir("agentline-config-bak-", async (dir) => {
      const cfg = join(dir, "config.json");
      await backupAndWriteConfig(cfg, A);
      expect(await readJson(cfg)).toEqual(A);
      // No prior config → nothing to back up.
      await expect(readConfigBackup(cfg)).resolves.toBeNull();
    });
  });

  it("backs up the prior config bytes before writing the new one", async () => {
    await withTmpDir("agentline-config-bak-", async (dir) => {
      const cfg = join(dir, "config.json");
      await backupAndWriteConfig(cfg, A); // seed
      await backupAndWriteConfig(cfg, B); // A becomes the backup
      expect(await readJson(cfg)).toEqual(B);
      expect(await readConfigBackup(cfg)).toEqual(A);
    });
  });

  it("refreshes the backup to the immediately-prior config on each write (single-level)", async () => {
    await withTmpDir("agentline-config-bak-", async (dir) => {
      const cfg = join(dir, "config.json");
      const C = { version: 1, lines: [{ widgets: [{ type: "plan" }] }] };
      await backupAndWriteConfig(cfg, A);
      await backupAndWriteConfig(cfg, B); // bak = A
      await backupAndWriteConfig(cfg, C); // bak = B (not A — single slot)
      expect(await readConfigBackup(cfg)).toEqual(B);
    });
  });

  it("writes atomically — no leftover temp files in the dir", async () => {
    await withTmpDir("agentline-config-bak-", async (dir) => {
      const cfg = join(dir, "config.json");
      await backupAndWriteConfig(cfg, A);
      await backupAndWriteConfig(cfg, B);
      const entries = await fs.readdir(dir);
      expect(entries.filter((e) => e.includes(".tmp"))).toEqual([]);
    });
  });
});

describe("readConfigBackup", () => {
  it("returns null when no backup exists", async () => {
    await withTmpDir("agentline-config-bak-", async (dir) => {
      await expect(readConfigBackup(join(dir, "config.json"))).resolves.toBeNull();
    });
  });

  it("throws a helpful error when the backup is malformed JSON", async () => {
    await withTmpDir("agentline-config-bak-", async (dir) => {
      const cfg = join(dir, "config.json");
      await fs.writeFile(configBackupPath(cfg), "{not json");
      await expect(readConfigBackup(cfg)).rejects.toThrow(/not valid JSON/);
    });
  });
});

describe("restoreConfigBackup", () => {
  it("restores the backup over the current config and returns the restored config", async () => {
    await withTmpDir("agentline-config-bak-", async (dir) => {
      const cfg = join(dir, "config.json");
      await backupAndWriteConfig(cfg, A); // seed
      await backupAndWriteConfig(cfg, B); // bak = A, current = B
      const restored = await restoreConfigBackup(cfg);
      expect(restored).toEqual(A);
      expect(await readJson(cfg)).toEqual(A);
    });
  });

  it("returns null and does not write when there is no backup", async () => {
    await withTmpDir("agentline-config-bak-", async (dir) => {
      const cfg = join(dir, "config.json");
      await fs.writeFile(cfg, JSON.stringify(B));
      const restored = await restoreConfigBackup(cfg);
      expect(restored).toBeNull();
      expect(await readJson(cfg)).toEqual(B); // untouched
    });
  });

  it("leaves the backup in place after restoring (idempotent re-undo, not a redo)", async () => {
    await withTmpDir("agentline-config-bak-", async (dir) => {
      const cfg = join(dir, "config.json");
      await backupAndWriteConfig(cfg, A);
      await backupAndWriteConfig(cfg, B);
      await restoreConfigBackup(cfg);
      // bak still = A; a second restore is a no-op-equivalent (same bytes)
      expect(await readConfigBackup(cfg)).toEqual(A);
      const again = await restoreConfigBackup(cfg);
      expect(again).toEqual(A);
    });
  });
});
