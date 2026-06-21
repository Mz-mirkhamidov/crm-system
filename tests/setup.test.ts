// Infrastructure smoke test for Task 1.
//
// Confirms the test runner is wired up correctly, that the Node test runtime exposes
// Web Crypto (`globalThis.crypto.subtle`) like the Edge runtime used by proxy.ts, that
// the test SESSION_SECRET is available, and that the signing helper produces a
// `data.sig` token whose HMAC verifies. This is NOT a Property test; it only validates
// the test scaffolding that tasks 2, 3, 6, and 8 depend on.
import { describe, it, expect } from "vitest";
import {
  TEST_SESSION_SECRET,
  signTestSession,
  hmacSign,
  base64urlEncode,
  makeOperator,
} from "./helpers/session-helper";

describe("test infrastructure", () => {
  it("exposes Web Crypto subtle in the Node test runtime", () => {
    expect(globalThis.crypto).toBeDefined();
    expect(typeof globalThis.crypto.subtle.sign).toBe("function");
    expect(typeof globalThis.crypto.subtle.verify).toBe("function");
  });

  it("loads the test SESSION_SECRET into the environment", () => {
    expect(process.env.SESSION_SECRET).toBe(TEST_SESSION_SECRET);
  });

  it("signs a session into a two-segment data.sig token", async () => {
    const op = makeOperator({ role: "admin" });
    const token = await signTestSession(op);

    const parts = token.split(".");
    expect(parts).toHaveLength(2);

    const [data, sig] = parts;
    // Payload segment decodes back to the operator identity.
    const json = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
    expect(json.id).toBe(op.id);
    expect(json.role).toBe("admin");
    expect(typeof json.iat).toBe("number");
    expect(typeof json.exp).toBe("number");

    // Signature segment is a correct HMAC over the data segment.
    const expectedSig = await hmacSign(data);
    expect(sig).toBe(expectedSig);
  });

  it("produces a different signature when the payload is tampered", async () => {
    const op = makeOperator({ role: "operator" });
    const token = await signTestSession(op);
    const [data] = token.split(".");

    const tampered = base64urlEncode(
      JSON.stringify({ ...op, role: "admin", iat: 0, exp: 9999999999 })
    );
    const originalSig = await hmacSign(data);
    const tamperedSig = await hmacSign(tampered);
    expect(tamperedSig).not.toBe(originalSig);
  });
});
