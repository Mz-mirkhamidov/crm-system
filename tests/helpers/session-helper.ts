// Test helper for the auth-session-security-fix spec.
//
// Signs session payloads with a known test SESSION_SECRET using the SAME scheme the
// production fix will use (see design.md "Signed session token"):
//
//   data  = base64url(JSON.stringify(payload))
//   sig   = base64url(HMAC_SHA256(SESSION_SECRET, data))
//   token = `${data}.${sig}`
//
// This lets tests construct *validly signed* sessions so the "valid session" branch
// of `proxy.ts` / `verifySession` is exercised exactly as it would be in production
// (design Testing Strategy -> Preservation Checking). It uses only Web Crypto
// (`crypto.subtle`), so it runs in the Node test runtime and mirrors the Edge runtime.
//
// NOTE: This is test infrastructure (Task 1). It deliberately does NOT depend on the
// not-yet-implemented `signSession`/`verifySession` in `lib/session.ts`; it is a
// self-contained reference implementation of the signing scheme for use by later tasks.

import type { Operator } from "@/lib/session";

/** Deterministic secret used by tests. Mirrors `process.env.SESSION_SECRET`. */
export const TEST_SESSION_SECRET = "test-session-secret-do-not-use-in-prod";

/** Default token lifetime used by helpers (30 days, matching the planned cookie maxAge). */
export const DEFAULT_MAX_AGE_SECONDS = 2592000;

export interface SessionPayload extends Operator {
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expiry, seconds since epoch. */
  exp: number;
}

/** Base64url-encode a UTF-8 string (no padding), matching token encoding. */
export function base64urlEncode(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Base64url-encode raw bytes (no padding). */
export function base64urlEncodeBytes(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(new Uint8Array(bytes));
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Import a UTF-8 secret as an HMAC-SHA256 signing key via Web Crypto. */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Compute `base64url(HMAC_SHA256(secret, data))` over the already-encoded `data` segment.
 */
export async function hmacSign(data: string, secret: string = TEST_SESSION_SECRET): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64urlEncodeBytes(sig);
}

/**
 * Sign an operator into a `data.sig` token using the production signing scheme.
 *
 * @param op       The operator identity to embed.
 * @param options  Optional overrides for the test secret and token lifetime/expiry.
 */
export async function signTestSession(
  op: Operator,
  options: { secret?: string; iat?: number; exp?: number; maxAgeSeconds?: number } = {}
): Promise<string> {
  const secret = options.secret ?? TEST_SESSION_SECRET;
  const iat = options.iat ?? Math.floor(Date.now() / 1000);
  const exp = options.exp ?? iat + (options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS);

  const payload: SessionPayload = {
    id: op.id,
    name: op.name,
    phone: op.phone,
    role: op.role,
    iat,
    exp,
  };

  const data = base64urlEncode(JSON.stringify(payload));
  const sig = await hmacSign(data, secret);
  return `${data}.${sig}`;
}

/**
 * Build a FORGED, UNSIGNED cookie value: plain base64 of the operator JSON, exactly as
 * the current vulnerable `encodeSession` produces. This is the attacker-controlled token
 * used by the bug-condition exploration tests (it carries a usable identity but NO valid
 * server signature).
 */
export function forgeUnsignedSession(op: Partial<Operator> & { id: string; role: string }): string {
  return Buffer.from(JSON.stringify(op)).toString("base64");
}

/** Convenience operator factory for tests. */
export function makeOperator(overrides: Partial<Operator> = {}): Operator {
  return {
    id: overrides.id ?? "op-123",
    name: overrides.name ?? "Test Operator",
    phone: overrides.phone ?? "+998900000000",
    role: overrides.role ?? "operator",
  };
}
