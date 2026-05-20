import { describe, expect, it, vi } from "vitest";

import { fetchLatestVersion } from "./fetch.js";

function makeFetch(spec: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  throws?: unknown;
}): typeof fetch {
  return (async (..._args: unknown[]) => {
    if (spec.throws !== undefined) throw spec.throws;
    return {
      ok: spec.ok ?? true,
      status: spec.status ?? 200,
      json: async () => spec.json,
    };
  }) as unknown as typeof fetch;
}

describe("fetchLatestVersion", () => {
  it("returns the `version` field on a successful 200", async () => {
    const result = await fetchLatestVersion({
      fetchImpl: makeFetch({ json: { version: "0.2.0" } }),
    });
    expect(result).toBe("0.2.0");
  });

  it("trims whitespace around the returned version", async () => {
    const result = await fetchLatestVersion({
      fetchImpl: makeFetch({ json: { version: "  0.2.0  " } }),
    });
    expect(result).toBe("0.2.0");
  });

  it("returns null on a non-OK response", async () => {
    const result = await fetchLatestVersion({
      fetchImpl: makeFetch({ ok: false, status: 500 }),
    });
    expect(result).toBeNull();
  });

  it("returns null when the JSON body has no `version`", async () => {
    const result = await fetchLatestVersion({
      fetchImpl: makeFetch({ json: { name: "@odere-pro/agentline" } }),
    });
    expect(result).toBeNull();
  });

  it("returns null when the JSON body is not an object", async () => {
    const result = await fetchLatestVersion({
      fetchImpl: makeFetch({ json: "0.2.0" }),
    });
    expect(result).toBeNull();
  });

  it("returns null when the JSON body is an array", async () => {
    const result = await fetchLatestVersion({
      fetchImpl: makeFetch({ json: ["0.2.0"] }),
    });
    expect(result).toBeNull();
  });

  it("returns null when `version` is not a string", async () => {
    const result = await fetchLatestVersion({
      fetchImpl: makeFetch({ json: { version: 42 } }),
    });
    expect(result).toBeNull();
  });

  it("returns null when `version` is an empty string", async () => {
    const result = await fetchLatestVersion({
      fetchImpl: makeFetch({ json: { version: "   " } }),
    });
    expect(result).toBeNull();
  });

  it("returns null when the request throws (network error, abort, …)", async () => {
    const result = await fetchLatestVersion({
      fetchImpl: makeFetch({ throws: new Error("ENETUNREACH") }),
    });
    expect(result).toBeNull();
  });

  it("aborts via AbortController when the timeout elapses", async () => {
    vi.useFakeTimers();
    try {
      const calls: AbortSignal[] = [];
      const slowFetch = (async (_url: unknown, init: RequestInit) => {
        const signal = init.signal as AbortSignal;
        calls.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        });
      }) as unknown as typeof fetch;
      const promise = fetchLatestVersion({ fetchImpl: slowFetch, timeoutMs: 1000 });
      vi.advanceTimersByTime(1500);
      const result = await promise;
      expect(result).toBeNull();
      expect(calls[0]?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
