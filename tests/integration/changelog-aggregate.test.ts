/**
 * Integration tests for `scripts/changelog-aggregate.sh`.
 *
 * The script resolves its own repo root from `dirname $0`, so each test
 * copies it into a throwaway tree (`<sandbox>/scripts/`) alongside a
 * `CHANGELOG.md` and a `changelog/` fragment dir. Nothing touches the real
 * repository, and no git history is needed: an uncommitted fragment resolves
 * to the `unreleased` SHA placeholder, which keeps assertions stable.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rmrf } from "../../src/test-helpers/index.js";

const execFileP = promisify(execFile);
const repoRoot = (() => {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..");
})();

const HEADER = `# Changelog

## [Unreleased]

## [1.0.0] — 2026-01-01

### Fixed

- \`aaaaaaa\` — an older fix.
`;

interface Sandbox {
  root: string;
  changelog: string;
  script: string;
}

async function setupSandbox(unreleasedBlock: string): Promise<Sandbox> {
  const root = await fs.mkdtemp(join(tmpdir(), "agentline-cla-"));
  await fs.mkdir(join(root, "scripts"), { recursive: true });
  await fs.mkdir(join(root, "changelog"), { recursive: true });
  const script = join(root, "scripts", "changelog-aggregate.sh");
  await fs.copyFile(join(repoRoot, "scripts", "changelog-aggregate.sh"), script);
  const changelog = join(root, "CHANGELOG.md");
  await fs.writeFile(changelog, HEADER.replace("## [Unreleased]\n", unreleasedBlock));
  return { root, changelog, script };
}

async function addFragment(sb: Sandbox, name: string, body: string): Promise<void> {
  await fs.writeFile(join(sb.root, "changelog", name), body);
}

async function run(sb: Sandbox, args: string[] = []) {
  return execFileP("bash", [sb.script, ...args], { cwd: sb.root });
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

describe("scripts/changelog-aggregate.sh", () => {
  let sb: Sandbox;
  afterEach(async () => {
    await rmrf(sb.root);
  });

  describe("--apply with an existing `### Added`", () => {
    beforeEach(async () => {
      sb = await setupSandbox("## [Unreleased]\n\n### Added\n");
      await addFragment(sb, "100-thing.md", "- feat: added a thing.\n");
    });

    it("folds the bullet under the existing heading", async () => {
      await run(sb, ["--apply"]);
      const text = await fs.readFile(sb.changelog, "utf8");
      expect(text).toContain("### Added\n\n- `unreleased` — feat: added a thing.");
      expect(await exists(join(sb.root, "changelog", "100-thing.md"))).toBe(false);
    });
  });

  describe("--apply when `[Unreleased]` has no section heading", () => {
    beforeEach(async () => {
      sb = await setupSandbox("## [Unreleased]\n");
      await addFragment(sb, "101-fix.md", "- fix: fixed a thing.\n");
    });

    it("creates the default `### Added` heading instead of failing", async () => {
      await run(sb, ["--apply"]);
      const text = await fs.readFile(sb.changelog, "utf8");
      expect(text).toContain("## [Unreleased]\n\n### Added\n\n- `unreleased` — fix: fixed a thing.");
    });

    it("honours --section so a Fixed-only release can fold", async () => {
      await run(sb, ["--apply", "--section", "Fixed"]);
      const text = await fs.readFile(sb.changelog, "utf8");
      expect(text).toContain("## [Unreleased]\n\n### Fixed\n\n- `unreleased` — fix: fixed a thing.");
      // The pre-existing [1.0.0] ### Fixed must not be the insertion point.
      expect(text).toContain("- `aaaaaaa` — an older fix.");
    });

    it("leaves no CHANGELOG.md.tmp behind", async () => {
      await run(sb, ["--apply"]);
      expect(await exists(`${sb.changelog}.tmp`)).toBe(false);
    });
  });

  describe("failure paths", () => {
    beforeEach(async () => {
      sb = await setupSandbox("## [Unreleased]\n\n### Added\n");
      await addFragment(sb, "102-x.md", "- chore: x.\n");
    });

    it("errors when `## [Unreleased]` is absent, and cleans up its temp file", async () => {
      await fs.writeFile(sb.changelog, "# Changelog\n\n## [1.0.0] — 2026-01-01\n");
      await expect(run(sb, ["--apply"])).rejects.toThrow();
      expect(await exists(`${sb.changelog}.tmp`)).toBe(false);
      // A failed apply must not consume the fragment.
      expect(await exists(join(sb.root, "changelog", "102-x.md"))).toBe(true);
    });

    it("rejects a malformed --section name", async () => {
      await expect(run(sb, ["--apply", "--section", "Added; rm -rf /"])).rejects.toThrow();
      expect(await exists(`${sb.changelog}.tmp`)).toBe(false);
    });
  });

  describe("dry-run", () => {
    beforeEach(async () => {
      sb = await setupSandbox("## [Unreleased]\n");
      await addFragment(sb, "103-y.md", "- fix: y.\n");
    });

    it("prints the bullet and changes nothing on disk", async () => {
      const before = await fs.readFile(sb.changelog, "utf8");
      const { stdout } = await run(sb);
      expect(stdout).toContain("- `unreleased` — fix: y.");
      expect(await fs.readFile(sb.changelog, "utf8")).toBe(before);
      expect(await exists(join(sb.root, "changelog", "103-y.md"))).toBe(true);
      expect(await exists(`${sb.changelog}.tmp`)).toBe(false);
    });
  });
});
