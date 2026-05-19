import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, tryAsync, type Result } from "./result.js";

describe("Result", () => {
  it("ok narrows and exposes value", () => {
    const r: Result<number, string> = ok(7);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) expect(r.value).toBe(7);
  });

  it("err narrows and exposes error", () => {
    const r: Result<number, string> = err("boom");
    expect(isOk(r)).toBe(false);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toBe("boom");
  });

  it("results are frozen-shape — ok flag drives narrowing", () => {
    const a = ok({ x: 1 });
    const b = err(new Error("fail"));
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
  });
});

describe("tryAsync", () => {
  it("captures the value on success", async () => {
    const r = await tryAsync(async () => 42);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it("captures Error rejections", async () => {
    const r = await tryAsync(async () => {
      throw new Error("nope");
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toBe("nope");
  });

  it("wraps non-Error rejections in Error", async () => {
    const r = await tryAsync(async () => {
      throw "plain string";
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error).toBeInstanceOf(Error);
      expect(r.error.message).toBe("plain string");
    }
  });
});
