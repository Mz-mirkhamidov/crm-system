// Task 7 — Unit tests for the signed-session primitives (`lib/session.ts`)
// Spec: auth-session-security-fix
//
// Exercises `signSession` / `verifySession` directly (design Testing Strategy → Unit
// Tests; tasks.md Task 7 "Unit"):
//   - signSession → verifySession round-trips to the original Operator (id/name/phone/role)
//   - verifySession returns null for: tampered payload, tampered signature, wrong secret,
//     a missing/extra signature segment, and an expired `exp`.
//
// ============================================================================
// EXPECTED OUTCOME: **THESE TESTS PASS** on the fixed code (post Task 4).
// ============================================================================
// `signSession` reads `process.env.SESSION_SECRET`, which `tests/setup.ts` sets to
// `TEST_SESSION_SECRET` — the SAME secret the helper (`signTestSession` / `hmacSign`)
// uses. Tokens produced by `signSession` and by `signTestSession` are therefore
// interchangeable for `verifySession`, so we use `signSession` for the happy-path
// round-trip and the helper for crafted (wrong-secret / expired) tokens.
//
// NOTE: This is NOT a property test; do not gate it through update_pbt_status.

import { describe, it, expect } from "vitest";
import { signSession, verifySession, type Operator } from "@/lib/session";
import {
  signTestSession,
  hmacSign,
  base64urlEncode,
  makeOperator,
  TEST_SESSION_SECRET,
} from "./helpers/session-helper";

describe("session unit: signSession → verifySession round-trip", () => {
  it("round-trips an operator session preserving id/name/phone/role", async () => {
    const op = makeOperator({
      id: "op-round-trip-1",
      name: "Round Trip",
      phone: "+998901112233",
      role: "operator",
    });

    const token = await signSession(op);
    const verified = await verifySession(token);

    expect(verified).not.toBeNull();
    expect(verified).toEqual({
      id: op.id,
      name: op.name,
      phone: op.phone,
      role: op.role,
    });
  });

  it("round-trips an admin session preserving the admin role", async () => {
    const admin = makeOperator({ id: "admin-1", name: "Boss", role: "admin" });

    const token = await signSession(admin);
    const verified = await verifySession(token);

    expect(verified).not.toBeNull();
    expect(verified?.role).toBe("admin");
    expect(verified?.id).toBe("admin-1");
  });

  it("produces a two-segment `data.sig` token that the helper would also accept", async () => {
    const op = makeOperator({ role: "operator" });
    const token = await signSession(op);

    const parts = token.split(".");
    expect(parts).toHaveLength(2);

    // The signature segment is a correct HMAC over the data segment using the SAME secret
    // the helper uses (proves signSession and signTestSession are interchangeable).
    const [data, sig] = parts;
    expect(sig).toBe(await hmacSign(data, TEST_SESSION_SECRET));
  });
});

describe("session unit: verifySession rejects invalid tokens (returns null)", () => {
  it("returns null for a tampered payload (data mutated, original sig kept)", async () => {
    const op = makeOperator({ role: "operator" });
    const token = await signSession(op);
    const [data, sig] = token.split(".");

    // Forge a NEW payload (escalate to admin) but keep the ORIGINAL signature. The HMAC
    // no longer matches the data, so verification must fail.
    const tamperedData = base64urlEncode(
      JSON.stringify({
        id: op.id,
        name: op.name,
        phone: op.phone,
        role: "admin",
        iat: 0,
        exp: 9_999_999_999,
      })
    );
    expect(tamperedData).not.toBe(data);

    const tamperedToken = `${tamperedData}.${sig}`;
    expect(await verifySession(tamperedToken)).toBeNull();
  });

  it("returns null for a tampered signature (sig mutated, data kept)", async () => {
    const op = makeOperator({ role: "operator" });
    const token = await signSession(op);
    const [data, sig] = token.split(".");

    // Flip the first character of the signature segment to a different base64url char.
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(flipped).not.toBe(sig);

    expect(await verifySession(`${data}.${flipped}`)).toBeNull();
  });

  it("returns null when the token was signed with a DIFFERENT secret", async () => {
    const op = makeOperator({ role: "admin" });
    // Sign with a secret that does NOT match process.env.SESSION_SECRET.
    const token = await signTestSession(op, { secret: "a-totally-different-secret" });

    // verifySession recomputes the HMAC with the real SESSION_SECRET → mismatch → null.
    expect(await verifySession(token)).toBeNull();
  });

  it("returns null for a missing signature segment / wrong number of parts", async () => {
    const op = makeOperator({ role: "operator" });
    const token = await signSession(op);
    const [data, sig] = token.split(".");

    // No "." at all (only the data segment, no signature).
    expect(await verifySession(data)).toBeNull();
    // Trailing dot with an empty signature segment.
    expect(await verifySession(`${data}.`)).toBeNull();
    // Leading dot with an empty data segment.
    expect(await verifySession(`.${sig}`)).toBeNull();
    // Three segments (an extra "." splits into too many parts).
    expect(await verifySession(`${data}.${sig}.extra`)).toBeNull();
    // Empty string.
    expect(await verifySession("")).toBeNull();
  });

  it("returns null for an expired token (exp in the past)", async () => {
    const op = makeOperator({ role: "operator" });
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Validly signed (correct secret) but already expired 10 seconds ago.
    const expired = await signTestSession(op, {
      iat: nowSeconds - 3600,
      exp: nowSeconds - 10,
    });

    expect(await verifySession(expired)).toBeNull();
  });

  it("still accepts a validly signed, unexpired token (control for the expiry case)", async () => {
    const op = makeOperator({ role: "operator" });
    const nowSeconds = Math.floor(Date.now() / 1000);

    const valid = await signTestSession(op, {
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    });

    const verified = await verifySession(valid);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(op.id);
  });

  it("returns null for a syntactically valid token with a non-JSON payload", async () => {
    // A correctly *signed* but non-JSON data segment must still be rejected at parse time.
    const data = base64urlEncode("not-json-at-all");
    const sig = await hmacSign(data, TEST_SESSION_SECRET);
    expect(await verifySession(`${data}.${sig}`)).toBeNull();
  });

  it("returns null for a signed payload missing id/role", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const data = base64urlEncode(
      JSON.stringify({ name: "No Id", phone: "x", iat: nowSeconds, exp: nowSeconds + 3600 })
    );
    const sig = await hmacSign(data, TEST_SESSION_SECRET);
    expect(await verifySession(`${data}.${sig}`)).toBeNull();
  });
});

// Type-only reference so the imported Operator type is anchored to lib/session.
export type _OperatorRef = Operator;
