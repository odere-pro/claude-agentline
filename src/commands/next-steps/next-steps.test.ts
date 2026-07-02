import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { printNextSteps } from "./next-steps.js";

describe("printNextSteps", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  function printed(): string {
    return writeSpy.mock.calls.map((c: readonly unknown[]) => String(c[0])).join("");
  }

  it("leads with the restart step — the one action that makes the statusline visible", () => {
    printNextSteps();
    expect(printed()).toContain("Restart Claude Code");
  });

  it("lists the forward actions: edit and uninstall", () => {
    printNextSteps();
    const out = printed();
    expect(out).toContain("Next steps:");
    expect(out).toContain("`agentline edit`");
    expect(out).toContain("`agentline uninstall`");
  });

  it("does NOT repeat the doctor hint that scripts/install.sh already prints", () => {
    printNextSteps();
    expect(printed()).not.toContain("doctor");
  });

  it("surfaces the ultracode default + opt-out so a fresh install discovers it (issue #295)", () => {
    printNextSteps();
    const out = printed();
    expect(out).toContain("ultracode");
    // Points at the `literal` variant — the opt-out path the editor actually exposes.
    expect(out).toContain("`literal` variant");
  });

  it("describes uninstall accurately ('remove', not 'undo everything')", () => {
    printNextSteps();
    const out = printed();
    expect(out).toContain("remove agentline");
    expect(out).not.toContain("undo everything");
  });

  it("starts with a blank line to separate it from the script's output", () => {
    printNextSteps();
    expect(printed().startsWith("\n")).toBe(true);
  });
});
