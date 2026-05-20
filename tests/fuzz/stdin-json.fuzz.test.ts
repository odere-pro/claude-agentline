/**
 * Property-based fuzzing of the stdin contract parser.
 *
 * The stdin payload is the one fully-untrusted input on the render hot
 * path. These properties assert the parser degrades gracefully on
 * arbitrary input: the pure adapter never throws, and the I/O path only
 * ever fails with the typed `StdinParseError` — never an unexpected
 * runtime error that would crash the statusline.
 */

import { Readable } from "node:stream";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  adaptStatuslinePayload,
  readStdinPayload,
  StdinParseError,
} from "../../src/core/stdin/index.js";

describe("fuzz: adaptStatuslinePayload", () => {
  it("never throws and preserves invariants for arbitrary objects", () => {
    fc.assert(
      fc.property(fc.object(), (raw) => {
        const payload = adaptStatuslinePayload(raw as Record<string, unknown>);
        expect(payload.raw).toBe(raw);
        expect(typeof payload.truncated).toBe("boolean");
        expect(typeof payload.translatorVersion).toBe("number");
        for (const key of ["model", "modelDisplayName", "version", "cwd"] as const) {
          const v = payload[key];
          expect(v === undefined || typeof v === "string").toBe(true);
        }
        if (payload.contextWindow) {
          for (const n of Object.values(payload.contextWindow)) {
            expect(Number.isFinite(n)).toBe(true);
          }
        }
      }),
    );
  });
});

describe("fuzz: readStdinPayload", () => {
  it("resolves or rejects only with StdinParseError for arbitrary bytes", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (text) => {
        try {
          const payload = await readStdinPayload(Readable.from([Buffer.from(text, "utf8")]));
          expect(payload).toHaveProperty("raw");
          expect(typeof payload.truncated).toBe("boolean");
        } catch (err) {
          expect(err).toBeInstanceOf(StdinParseError);
        }
      }),
    );
  });

  it("round-trips arbitrary JSON objects without throwing", async () => {
    await fc.assert(
      fc.asyncProperty(fc.object(), async (obj) => {
        const json = JSON.stringify(obj);
        const payload = await readStdinPayload(Readable.from([Buffer.from(json, "utf8")]));
        expect(payload).toHaveProperty("raw");
      }),
    );
  });
});
