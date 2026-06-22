// Discriminated-union result type returned by every repository function
// (frontend-ux-improvements design §3, Requirements 4.4, 3.3). Forces every caller to
// handle the failure case explicitly, so errors are never silently swallowed.

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T = never>(error: string): Result<T> {
  return { ok: false, error };
}
