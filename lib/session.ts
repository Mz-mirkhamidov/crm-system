export const SESSION_COOKIE = "crm_op_session";

/** Default session lifetime: 30 days, matching the cookie maxAge. */
export const SESSION_MAX_AGE_SECONDS = 2592000;

export interface Operator {
  id: string;
  name: string;
  phone: string;
  role: "admin" | "operator";
}

interface SignedPayload extends Operator {
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expiry, seconds since epoch. */
  exp: number;
}

// ---------------------------------------------------------------------------
// Edge-safe base64url helpers (Web Crypto only — no Node Buffer dependency).
//
// These mirror the encoding used by the signing scheme in design.md:
//   data = base64url(JSON.stringify(payload))
//   sig  = base64url(HMAC_SHA256(SESSION_SECRET, data))
// and by the test helper in tests/helpers/session-helper.ts.
// ---------------------------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  let b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stringToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

/**
 * Copy a (possibly `ArrayBufferLike`/`SharedArrayBuffer`-backed) `Uint8Array` view into a
 * freshly-allocated, plain `ArrayBuffer`. Under Next.js 16 / strict lib.dom typings the
 * Web Crypto `BufferSource` parameters require an `ArrayBufferView<ArrayBuffer>`, which a
 * `Uint8Array<ArrayBufferLike>` (e.g. the output of `TextEncoder.encode` or our base64url
 * decoder) does not satisfy. Passing the returned `ArrayBuffer` keeps behavior identical
 * (the bytes are copied verbatim) while satisfying the type checker on Edge + Node.
 */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(view.byteLength);
  new Uint8Array(ab).set(view);
  return ab;
}

function base64UrlToString(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

/**
 * Read the server-held signing secret. Fails fast when it is missing so that we never
 * sign or trust a session without a configured secret.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Refusing to sign or verify sessions without a signing secret."
    );
  }
  return secret;
}

/** Import the UTF-8 secret as an HMAC-SHA256 key via Web Crypto (Edge + Node compatible). */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Sign an operator into an HMAC-SHA256 signed token of the form `data.sig`, where
 * `data = base64url(JSON.stringify(payload))` and
 * `sig = base64url(HMAC_SHA256(SESSION_SECRET, data))`.
 *
 * Server-only. Throws if `SESSION_SECRET` is not configured.
 */
export async function signSession(
  op: Operator,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS
): Promise<string> {
  const secret = getSessionSecret();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + maxAgeSeconds;

  const payload: SignedPayload = {
    id: op.id,
    name: op.name,
    phone: op.phone,
    role: op.role,
    iat,
    exp,
  };

  const data = stringToBase64Url(JSON.stringify(payload));
  const key = await importHmacKey(secret);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, toArrayBuffer(new TextEncoder().encode(data)));
  const sig = bytesToBase64Url(new Uint8Array(sigBuffer));
  return `${data}.${sig}`;
}

/**
 * Verify an HMAC-signed session token and return the embedded `Operator` only when the
 * signature is valid (constant-time via `crypto.subtle.verify`) and the token is unexpired.
 *
 * Returns `null` for tokens with a missing/extra segment, an invalid signature, a wrong
 * secret, an unparseable payload, a missing `id`/`role`, or an `exp` in the past. Safe to
 * run at the Edge — uses only Web Crypto primitives.
 */
export async function verifySession(token: string): Promise<Operator | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    return null;
  }

  let isValid: boolean;
  try {
    const key = await importHmacKey(secret);
    const signatureBytes = base64UrlToBytes(sig);
    isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(new TextEncoder().encode(data))
    );
  } catch {
    return null;
  }
  if (!isValid) return null;

  let payload: Partial<SignedPayload>;
  try {
    payload = JSON.parse(base64UrlToString(data));
  } catch {
    return null;
  }

  if (!payload || !payload.id || !payload.role) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < nowSeconds) return null;

  return {
    id: payload.id,
    name: payload.name ?? "",
    phone: payload.phone ?? "",
    role: payload.role,
  };
}

// ---------------------------------------------------------------------------
// Legacy / non-authoritative helpers.
//
// The plain-base64 `encodeSession`/`decodeSession` path is NO LONGER used for
// authentication: `proxy.ts` now trusts only `verifySession`. `decodeSession` performs no
// integrity check and MUST NOT be treated as authoritative — it is retained privately for
// the client-side identity read below, which task 5 replaces with a server source.
// ---------------------------------------------------------------------------

function decodeUnsignedSession(value: string): Operator | null {
  try {
    const data = JSON.parse(Buffer.from(value, "base64").toString("utf-8"));
    if (!data.id || !data.role) return null;
    return data as Operator;
  } catch {
    return null;
  }
}

export function encodeSession(op: Operator): string {
  return Buffer.from(JSON.stringify(op)).toString("base64");
}

// Client-side: parse cookie from document.cookie. NOT authoritative — the server-verified
// session from `verifySession` (in `proxy.ts`) is the single source of truth for access
// control. Retained only for the current client UI identity read (replaced in task 5).
export function getClientSession(): Operator | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split(";").find((c) => c.trim().startsWith(SESSION_COOKIE + "="));
  if (!match) return null;
  return decodeUnsignedSession(match.split("=").slice(1).join("=").trim());
}

// NOTE (Task 6.1): the legacy client-side password-hashing helper (a fast SHA-256 using a
// single static application-wide salt) has been REMOVED. Passwords are no longer hashed in the
// browser at all — the raw password is submitted over HTTPS and hashed server-side with
// slow, per-user-salted bcrypt via pgcrypto (see supabase/migrations/006_password_hashing.sql
// and the auth route handlers). This satisfies design Property 3.
