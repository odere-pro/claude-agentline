import { describe, it, expect } from "vitest";
import {
  andThen,
  err,
  isErr,
  isOk,
  mapErr,
  mapOk,
  ok,
  tryAsync,
  type Result,
} from "./result.js";

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

describe("mapOk / mapErr", () => {
  it("mapOk transforms the success value", () => {
    expect(mapOk(ok(2), (n) => n + 3)).toEqual(ok(5));
  });

  it("mapOk passes Err through unchanged", () => {
    const e: Result<number, string> = err("boom");
    expect(mapOk(e, (n: number) => n + 1)).toEqual(err("boom"));
  });

  it("mapErr transforms the error channel", () => {
    expect(mapErr(err("boom"), (s) => s.toUpperCase())).toEqual(err("BOOM"));
  });

  it("mapErr passes Ok through unchanged", () => {
    const o: Result<number, string> = ok(7);
    expect(mapErr(o, (s) => `${s}!`)).toEqual(ok(7));
  });
});

describe("andThen — Either-monad laws (smoke)", () => {
  const inc = (n: number): Result<number, string> => ok(n + 1);
  const dbl = (n: number): Result<number, string> => ok(n * 2);
  const fail = (_n: number): Result<number, string> => err("nope");

  it("left identity: andThen(ok(x), f) === f(x)", () => {
    expect(andThen(ok(3), inc)).toEqual(inc(3));
  });

  it("right identity: andThen(m, ok) === m", () => {
    const m: Result<number, string> = ok(5);
    expect(andThen(m, (v) => ok(v))).toEqual(m);
  });

  it("associativity: (m.andThen(f)).andThen(g) === m.andThen(x => f(x).andThen(g))", () => {
    const m: Result<number, string> = ok(2);
    const lhs = andThen(andThen(m, inc), dbl);
    const rhs = andThen(m, (x) => andThen(inc(x), dbl));
    expect(lhs).toEqual(rhs);
  });

  it("short-circuits on Err", () => {
    expect(andThen(err("stop"), inc)).toEqual(err("stop"));
  });

  it("propagates an Err produced mid-chain", () => {
    expect(andThen(andThen(ok(1), fail), inc)).toEqual(err("nope"));
  });
});
