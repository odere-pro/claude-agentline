/**
 * Tests for the config-backup helper — a reversible 2-slot scheme backing
 * `agentline config undo` / `config redo`.
 *
 * Every config-writing path backs up the prior config to the back slot
 * (`config.json.bak`) BEFORE the new config lands, through the one
 * atomic-write helper, and INVALIDATES the forward slot (a new edit
 * diverges, so any pending redo is unreachable). `undoConfig` rolls back
 * (capturing the pre-undo state into the forward slot `config.json.redo`);
 * `redoConfig` rolls forward (capturing the pre-redo state into the back
 * slot). Distinct from the host-statusLine `settings-backup.json`.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { withTmpDir } from "../../../test-helpers/index.js";
import {
  backupAndWriteConfig,
  configBackupPath,
  configRedoPath,
  readConfigBackup,
  readConfigRedo,
  redoConfig,
  restoreConfigBackup,
  undoConfig,
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

const C = { version: 1, lines: [{ widgets: [{ type: "plan" }] }] };

describe("configRedoPath", () => {
  it("is the config path with a .redo suffix", () => {
    expect(configRedoPath("/cfg/agentline/config.json")).toBe("/cfg/agentline/config.json.redo");
  });
});

describe("undoConfig / redoConfig (reversible 2-slot stack)", () => {
  it("undo returns null and does not write when there is no backup", async () => {
    await withTmpDir("agentline-config-redo-", async (dir) => {
      const cfg = join(dir, "config.json");
      await fs.writeFile(cfg, JSON.stringify(B));
      expect(await undoConfig(cfg)).toBeNull();
      expect(await readJson(cfg)).toEqual(B);
      // No forward slot is created on a no-op undo.
      expect(await readConfigRedo(cfg)).toBeNull();
    });
  });

  it("redo returns null and does not write when there is no forward slot", async () => {
    await withTmpDir("agentline-config-redo-", async (dir) => {
      const cfg = join(dir, "config.json");
      await fs.writeFile(cfg, JSON.stringify(B));
      expect(await redoConfig(cfg)).toBeNull();
      expect(await readJson(cfg)).toEqual(B);
    });
  });

  it("undo captures the pre-undo config into the forward slot", async () => {
    await withTmpDir("agentline-config-redo-", async (dir) => {
      const cfg = join(dir, "config.json");
      await backupAndWriteConfig(cfg, A); // seed, bak empty
      await backupAndWriteConfig(cfg, B); // bak = A, current = B
      const restored = await undoConfig(cfg); // current = A, redo = B
      expect(restored).toEqual(A);
      expect(await readJson(cfg)).toEqual(A);
      expect(await readConfigRedo(cfg)).toEqual(B);
    });
  });

  it("redo rolls forward to the forward slot and re-primes the back slot", async () => {
    await withTmpDir("agentline-config-redo-", async (dir) => {
      const cfg = join(dir, "config.json");
      await backupAndWriteConfig(cfg, A);
      await backupAndWriteConfig(cfg, B); // bak = A, current = B
      await undoConfig(cfg); // current = A, redo = B
      const rolledForward = await redoConfig(cfg); // current = B, bak = A
      expect(rolledForward).toEqual(B);
      expect(await readJson(cfg)).toEqual(B);
      expect(await readConfigBackup(cfg)).toEqual(A);
    });
  });

  it("undo → redo → undo round-trips to identical bytes", async () => {
    await withTmpDir("agentline-config-redo-", async (dir) => {
      const cfg = join(dir, "config.json");
      await backupAndWriteConfig(cfg, A);
      await backupAndWriteConfig(cfg, B); // current = B, bak = A
      await undoConfig(cfg);
      expect(await readJson(cfg)).toEqual(A);
      await redoConfig(cfg);
      expect(await readJson(cfg)).toEqual(B);
      await undoConfig(cfg);
      expect(await readJson(cfg)).toEqual(A);
    });
  });

  it("a new mutation after an undo invalidates the forward slot (can't redo a diverged branch)", async () => {
    await withTmpDir("agentline-config-redo-", async (dir) => {
      const cfg = join(dir, "config.json");
      await backupAndWriteConfig(cfg, A);
      await backupAndWriteConfig(cfg, B); // current = B, bak = A
      await undoConfig(cfg); // current = A, redo = B
      expect(await readConfigRedo(cfg)).toEqual(B);
      await backupAndWriteConfig(cfg, C); // diverge: current = C, bak = A, redo GONE
      expect(await readConfigRedo(cfg)).toBeNull();
      expect(await redoConfig(cfg)).toBeNull();
      expect(await readJson(cfg)).toEqual(C);
    });
  });

  it("writes atomically — no leftover temp files across an undo/redo cycle", async () => {
    await withTmpDir("agentline-config-redo-", async (dir) => {
      const cfg = join(dir, "config.json");
      await backupAndWriteConfig(cfg, A);
      await backupAndWriteConfig(cfg, B);
      await undoConfig(cfg);
      await redoConfig(cfg);
      const entries = await fs.readdir(dir);
      expect(entries.filter((e) => e.includes(".tmp"))).toEqual([]);
    });
  });
});
