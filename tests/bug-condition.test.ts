// Task 2 — Bug Condition Exploration Test (Property 1)
// Spec: auth-session-security-fix
//
// Property 1 — Bug Condition / Expected Behavior:
//   Forged / unsigned / tampered `crm_op_session` cookies MUST be rejected.
//
// Encodes the design `isBugCondition(request)`: a `crm_op_session` cookie decodes to a
// usable identity (`id` + `role`) but carries NO valid server HMAC signature. The desired
// (expected) behavior is that the middleware treats the request as UNAUTHENTICATED and
// redirects to `/login`, granting no role and establishing no identity.
//
// ============================================================================
// EXPECTED OUTCOME ON UNFIXED CODE: **THIS TEST IS EXPECTED TO FAIL.**
// ============================================================================
// The unfixed `proxy.ts` calls `decodeSession`, which only base64-decodes the cookie and
// checks for the presence of `id`/`role` — it performs NO signature verification. A forged
// `role:"admin"` cookie therefore decodes to a "valid" admin identity and the middleware
// SERVES `/admin` (returns NextResponse.next()) instead of redirecting to `/login`.
//
// The assertions below demand the *correct* behavior (redirect to `/login`). On the
// UNFIXED code they will FAIL — and that failure is the desired result: it proves the
// authentication-bypass / privilege-escalation bug exists and confirms the root cause
// (no signature on the token; `proxy.ts` trusts the decoded `role`/`id` verbatim).
//
// After Task 4 implements HMAC-signed, server-validated sessions (`verifySession`), these
// SAME assertions will PASS (Task 4.3), confirming the bug is closed.
//
// Documented counterexamples (see also the property runner below):
//   - Forged admin cookie  base64({"id":"x","name":"x","phone":"x","role":"admin"})
//     → UNFIXED: served `/admin`        | EXPECTED: redirect `/login`   (covers 1.2 / 2.2)
//   - Forged operator cookie (arbitrary id, role:"operator")
//     → UNFIXED: identity established    | EXPECTED: redirect `/login`   (covers 1.3 / 2.3)
//   - Tampered legit cookie (operator payload with role flipped to "admin", re-base64'd)
//     → UNFIXED: admin access granted    | EXPECTED: redirect `/login`   (covers 2.1)

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE, type Operator } from "@/lib/session";
import { forgeUnsignedSession, makeOperator } from "./helpers/session-helper";

const ORIGIN = "http://localhost";

type Decision =
  | { type: "REDIRECT"; location: string }
  | { type: "NEXT" };

/**
 * Run a path + (optional) forged cookie through the real `proxy.ts` middleware and
 * classify the outcome as either a redirect (with its target pathname) or a pass-through.
 */
async function middlewareDecision(path: string, cookieValue?: string): Promise<Decision> {
  const req = new NextRequest(new URL(path, ORIGIN));
  if (cookieValue !== undefined) {
    req.cookies.set(SESSION_COOKIE, cookieValue);
  }
  const res = await proxy(req);

  const location = res.headers.get("location");
  if (location) {
    // Normalize to a pathname so assertions are origin-independent.
    return { type: "REDIRECT", location: new URL(location, ORIGIN).pathname };
  }
  return { type: "NEXT" };
}

/** True iff the middleware redirected the request to the login page. */
function isRedirectToLogin(decision: Decision): boolean {
  return decision.type === "REDIRECT" && decision.location === "/login";
}

describe("Property 1 (Bug Condition): forged / unsigned sessions are rejected", () => {
  // --- Concrete deterministic counterexamples (for reproducibility) ------------------

  it("rejects a forged admin cookie and redirects to /login (covers 1.2 / 2.2)", async () => {
    // base64({"id":"x","name":"x","phone":"x","role":"admin"}) — no server signature.
    const forgedAdmin = forgeUnsignedSession({
      id: "x",
      name: "x",
      phone: "x",
      role: "admin",
    });

    const decision = await middlewareDecision("/admin", forgedAdmin);

    // EXPECTED (post-fix): redirect to /login, no admin content served.
    // UNFIXED: this FAILS because the forged admin identity is trusted and `/admin` is served.
    expect(isRedirectToLogin(decision)).toBe(true);
  });

  it("rejects a forged operator cookie and establishes no identity (covers 1.3 / 2.3)", async () => {
    // Arbitrary id + role:"operator", base64-encoded without a signature.
    const forgedOperator = forgeUnsignedSession({
      id: "impersonated-operator-999",
      name: "Mallory",
      phone: "+998000000000",
      role: "operator",
    });

    // A protected operator route: with no *valid* identity this must redirect to /login.
    const decision = await middlewareDecision("/dashboard", forgedOperator);

    // EXPECTED (post-fix): redirect to /login (no identity established).
    // UNFIXED: this FAILS because the forged operator identity is accepted and served.
    expect(isRedirectToLogin(decision)).toBe(true);
  });

  it("rejects a tampered legitimate cookie with role escalated to admin (covers 2.1)", async () => {
    // Start from a legitimate operator payload, flip role operator -> admin, re-base64-encode.
    const legitOperator: Operator = makeOperator({ role: "operator" });
    const tampered: Operator = { ...legitOperator, role: "admin" };
    const tamperedCookie = forgeUnsignedSession(tampered);

    const decision = await middlewareDecision("/admin", tamperedCookie);

    // EXPECTED (post-fix): signature mismatch → rejected → redirect to /login.
    // UNFIXED: this FAILS because the tampered admin role is trusted and `/admin` is served.
    expect(isRedirectToLogin(decision)).toBe(true);
  });

  // --- Property form: ALL unsigned identities on protected routes → REDIRECT("/login") ---

  it("redirects every unsigned forged identity to /login on protected routes", async () => {
    const protectedPaths = ["/", "/admin", "/dashboard", "/leads", "/clients", "/orders"];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string(),
          phone: fc.string(),
          role: fc.constantFrom("admin", "operator"),
        }),
        fc.constantFrom(...protectedPaths),
        async (identity, path) => {
          // Base64-encode the identity WITHOUT a valid server signature (the bug condition).
          const forged = forgeUnsignedSession(identity as Operator);
          const decision = await middlewareDecision(path, forged);

          // For every forged-but-usable identity, the only correct decision is to treat the
          // request as unauthenticated and redirect to /login. On UNFIXED code this property
          // FAILS — fast-check will surface a minimal counterexample (e.g. role:"admin").
          return isRedirectToLogin(decision);
        }
      ),
      { numRuns: 200 }
    );
  });
});
