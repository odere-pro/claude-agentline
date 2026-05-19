/**
 * Result / Either type.
 *
 * Used where a function has a clearly-named, recoverable failure mode
 * and the caller is expected to branch on it. The codebase otherwise
 * throws structured errors (e.g. `ConfigValidationError`,
 * `WidgetTypeMissingError`) and catches them at the CLI dispatcher —
 * that pattern stays the default. Result is for cases where:
 *
 *   - The "failure" is a normal control-flow outcome, not an exception
 *     (e.g. "user answered no" — see `projectGate`).
 *   - A fire-and-forget async path needs an explicit rejection sink
 *     instead of `void promise` (see the editor save handler).
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}

/**
 * Run an async producer and capture either its value or any thrown error
 * as a `Result`. Use at boundaries where unhandled rejection would
 * otherwise be silently swallowed (e.g. `useInput` callbacks that can't
 * be `await`ed).
 */
export async function tryAsync<T>(producer: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    return ok(await producer());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
