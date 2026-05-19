import { describe, it, expect } from "vitest";
import { CONFIG_SCHEMA, configSchemaJson } from "./embedded.js";

describe("embedded schema", () => {
  it("exposes the JSON schema with the expected $id", () => {
    expect(CONFIG_SCHEMA["$id"]).toMatch(/config\.schema\.json$/);
    expect(CONFIG_SCHEMA["title"]).toBe("agentline configuration");
  });

  it("formats with two-space indent and trailing newline", () => {
    const out = configSchemaJson();
    expect(out.startsWith("{\n  ")).toBe(true);
    expect(out.endsWith("\n")).toBe(true);
    expect(JSON.parse(out)).toEqual(CONFIG_SCHEMA);
  });
});
