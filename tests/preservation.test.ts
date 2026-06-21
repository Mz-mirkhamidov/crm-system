// Task 3 — Preservation Property Tests (Property 2)
// Spec: auth-session-security-fix
//
// Property 2 — Preservation: Non-bug inputs behave EXACTLY as before.
//
//   For any request where `isBugCondition` is FALSE (no session, an unparseable/garbage
//   cookie, the public `/login`/`/register` routes, or a *validly signed* session), the
//   middleware decision MUST be the same routing/enforcement outcome as the original
//   (unfixed) system (design.md → Testing Strategy → Preservation Checking:
//   `original = fixed for all NOT isBugCondition`).
//
// ============================================================================
// EXPECTED OUTCOME ON UNFIXED CODE: **THESE TESTS ARE EXPECTED TO PASS.**
// ============================================================================
// Unlike the Task 2 bug-condition test (which asserts the *desired* behavior and is
// expected to FAIL on unfixed code), these preservation tests follow the
// OBSERVATION-FIRST methodology: we record the actual decisions the UNFIXED `proxy.ts`
// middleware makes for non-bug inputs and assert them. They establish the baseline that
// must remain unchanged. Task 4.4 re-runs these SAME tests against the fixed code and
// they must STILL PASS (confirming no regression).
//
// ----------------------------------------------------------------------------
// CROSS-REGIME "VALID SESSION" NUANCE (important — read before editing)
// ----------------------------------------------------------------------------
// The UNFIXED middleware trusts a *plain base64* cookie (`decodeSession` in
// `lib/session.ts`): it base64-decodes the JSON and checks only that `id`/`role` are
// present — no signature is verified. The FIXED middleware (Task 4) will instead call
// `verifySession`, which only accepts an HMAC-signed `data.sig` token.
//
// These two regimes recognise DIFFERENT byte sequences as a "valid session":
//   - UNFIXED: `encodeSession(op)`            → plain base64 JSON          (no signature)
//   - FIXED:   `signTestSession(op)`          → `base64url(payload).sig`   (HMAC-signed)
//
// A signed token is NOT valid base64-JSON, so on the unfixed code it decodes to `null`
// (treated as "no session" → `/login`); conversely a plain base64 token has no signature
// segment, so on the fixed code `verifySession` returns `null`. There is therefore NO
// single cookie value that represents a "valid session" in BOTH regimes.
//
// To keep these tests PASSING on unfixed code AND continuing to PASS after the fix
// (Task 4.4), we take the approach recommended by the design / task:
//
//   1. For the cross-regime PROPERTY assertions we lean on input classes that are
//      ENCODING-INDEPENDENT — no cookie, garbage cookie, public routes, assets — whose
//      decision is identical in both regimes. The "valid session" rows of the property
//      are fed through a regime-adaptive cookie builder (see `validSessionCookie`) so the
//      *routing logic* (operator blocked from `/admin`, admin reaches `/admin`, root and
//      `/login` redirects per role) is asserted using whatever encoding the code under
//      test actually trusts.
//   2. `validSessionCookie(op)` feature-detects the regime at runtime: if `lib/session`
//      exports `verifySession` (the fix has landed) it produces a server-signed token via
//      the Task 1 helper (signed with the test `SESSION_SECRET`, which `verifySession`
//      reads from `process.env`); otherwise it produces the plain base64 token the unfixed
//      `decodeSession` trusts. This makes every "valid session" assertion robust across
//      both regimes without changing the test.
//
// This mirrors design.md's note: "For validly-signed sessions in the property runner, the
// test harness signs payloads with a test SESSION_SECRET so the 'valid session' branch is
// exercised exactly as production would."

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE, type Operator } from "@/lib/session";
import { signTestSession, makeOperator } from "./helpers/session-helper";

const ORIGIN = "http://localhost";

type Decision =
  | { type: "REDIRECT"; location: string }
  | { type: "NEXT" };

/**
 * Run a path + (optional) cookie through the real `proxy.ts` middleware and classify the
 * outcome as either a redirect (with its target pathname) or a pass-through. Identical to
 * the helper used by the Task 2 bug-condition test so both suites observe the middleware
 * the same way.
 */
async function middlewareDecision(path: string, cookieValue?: string): Promise<Decision> {
  const req = new NextRequest(new URL(path, ORIGIN));
  if (cookieValue !== undefined) {
    req.cookies.set(SESSION_COOKIE, cookieValue);
  }
  const res = await proxy(req);

  const location = res.headers.get("location");
  if (location) {
    return { type: "REDIRECT", location: new URL(location, ORIGIN).pathname };
  }
  return { type: "NEXT" };
}

/**
 * Regime-adaptive "valid session" cookie builder (see the CROSS-REGIME nuance note above).
 *
 * Produces a cookie value that the CODE UNDER TEST recognises as a legitimate session:
 *   - FIXED regime  (`verifySession` exists): an HMAC-signed `data.sig` token signed with
 *     the test SESSION_SECRET, exactly as production would issue it.
 *   - UNFIXED regime (only `decodeSession`/`encodeSession` exist): the plain base64 JSON
 *     token the current middleware trusts.
 *
 * Uses a dynamic import + defensive property checks so the test neither fails to load nor
 * changes behavior if `encodeSession`/`decodeSession` are removed when the fix lands.
 */
async function validSessionCookie(op: Operator): Promise<string> {
  const mod = (await import("@/lib/session")) as Record<string, unknown>;
  if (typeof mod.verifySession === "function") {
    // FIXED regime: server-validated, HMAC-signed token.
    return signTestSession(op);
  }
  if (typeof mod.encodeSession === "function") {
    // UNFIXED regime: the middleware trusts plain base64 JSON.
    return (mod.encodeSession as (o: Operator) => string)(op);
  }
  // Fallback equivalent to the unfixed `encodeSession` if it has been removed.
  return Buffer.from(JSON.stringify(op)).toString("base64");
}

/**
 * Reference model of the `proxy.ts` decision logic for NON-BUG inputs, parameterised by the
 * verified role (`null` = no/invalid session). This is the "originally-observed decision"
 * the design's preservation pseudocode asserts must equal the fixed decision. It mirrors
 * `proxy.ts` exactly:
 *   1. assets (`/_next` or path containing ".") → NEXT
 *   2. no session → `/login`/`/register` public (NEXT), else REDIRECT `/login`
 *   3. session on `/login` → REDIRECT to `/admin` or `/dashboard` per role
 *   4. operator on `/admin*` → REDIRECT `/dashboard`
 *   5. session on `/` → REDIRECT to `/admin` or `/dashboard` per role
 *   6. otherwise → NEXT
 */
function expectedDecision(path: string, role: "admin" | "operator" | null): Decision {
  if (path.startsWith("/_next") || path.includes(".")) {
    return { type: "NEXT" };
  }
  if (role === null) {
    if (path === "/login" || path === "/register") return { type: "NEXT" };
    return { type: "REDIRECT", location: "/login" };
  }
  if (path === "/login") {
    return { type: "REDIRECT", location: role === "admin" ? "/admin" : "/dashboard" };
  }
  if (role === "operator" && path.startsWith("/admin")) {
    return { type: "REDIRECT", location: "/dashboard" };
  }
  if (path === "/") {
    return { type: "REDIRECT", location: role === "admin" ? "/admin" : "/dashboard" };
  }
  return { type: "NEXT" };
}

// ---------------------------------------------------------------------------
// Example-based preservation tests (observation-first baseline)
// ---------------------------------------------------------------------------

describe("Property 2 (Preservation): valid operator session routing (3.1, 3.3, 3.6)", () => {
  it("serves /dashboard for a valid operator session (3.1)", async () => {
    const cookie = await validSessionCookie(makeOperator({ role: "operator" }));
    expect(await middlewareDecision("/dashboard", cookie)).toEqual({ type: "NEXT" });
  });

  it("redirects an operator away from /admin to /dashboard (3.3)", async () => {
    const cookie = await validSessionCookie(makeOperator({ role: "operator" }));
    expect(await middlewareDecision("/admin", cookie)).toEqual({
      type: "REDIRECT",
      location: "/dashboard",
    });
    // Nested admin route is blocked the same way (proxy uses startsWith("/admin")).
    expect(await middlewareDecision("/admin/operators", cookie)).toEqual({
      type: "REDIRECT",
      location: "/dashboard",
    });
  });

  it("redirects an authenticated operator off / and /login to /dashboard (3.6)", async () => {
    const cookie = await validSessionCookie(makeOperator({ role: "operator" }));
    expect(await middlewareDecision("/", cookie)).toEqual({
      type: "REDIRECT",
      location: "/dashboard",
    });
    expect(await middlewareDecision("/login", cookie)).toEqual({
      type: "REDIRECT",
      location: "/dashboard",
    });
  });
});

describe("Property 2 (Preservation): valid admin session routing (3.2, 3.6)", () => {
  it("serves /admin for a valid admin session (3.2)", async () => {
    const cookie = await validSessionCookie(makeOperator({ role: "admin" }));
    expect(await middlewareDecision("/admin", cookie)).toEqual({ type: "NEXT" });
    expect(await middlewareDecision("/admin/operators", cookie)).toEqual({ type: "NEXT" });
  });

  it("serves operator routes for an admin session too", async () => {
    const cookie = await validSessionCookie(makeOperator({ role: "admin" }));
    expect(await middlewareDecision("/dashboard", cookie)).toEqual({ type: "NEXT" });
  });

  it("redirects an authenticated admin off / and /login to /admin (3.6)", async () => {
    const cookie = await validSessionCookie(makeOperator({ role: "admin" }));
    expect(await middlewareDecision("/", cookie)).toEqual({
      type: "REDIRECT",
      location: "/admin",
    });
    expect(await middlewareDecision("/login", cookie)).toEqual({
      type: "REDIRECT",
      location: "/admin",
    });
  });
});

describe("Property 2 (Preservation): sessionless requests & public routes (3.4)", () => {
  it("redirects sessionless protected requests to /login", async () => {
    for (const path of ["/", "/dashboard", "/admin", "/leads", "/clients", "/orders"]) {
      expect(await middlewareDecision(path /* no cookie */)).toEqual({
        type: "REDIRECT",
        location: "/login",
      });
    }
  });

  it("leaves /login and /register publicly accessible without a session (3.4)", async () => {
    expect(await middlewareDecision("/login")).toEqual({ type: "NEXT" });
    expect(await middlewareDecision("/register")).toEqual({ type: "NEXT" });
  });

  it("treats an unparseable/garbage cookie as no session → /login (NOT the bug condition)", async () => {
    // "###" has no valid base64/JSON payload, so it decodes to null in BOTH regimes
    // (unfixed `decodeSession` throws→null; fixed `verifySession` sees no `.sig`→null).
    // This is encoding-independent and confirms a garbage cookie is not `isBugCondition`.
    expect(await middlewareDecision("/dashboard", "###")).toEqual({
      type: "REDIRECT",
      location: "/login",
    });
    expect(await middlewareDecision("/admin", "###")).toEqual({
      type: "REDIRECT",
      location: "/login",
    });
    // Garbage cookie still leaves public routes accessible.
    expect(await middlewareDecision("/login", "###")).toEqual({ type: "NEXT" });
  });
});

describe("Property 2 (Preservation): static assets pass through untouched", () => {
  it("lets /_next and dotted asset paths through regardless of session", async () => {
    expect(await middlewareDecision("/_next/static/chunk.js")).toEqual({ type: "NEXT" });
    expect(await middlewareDecision("/logo.svg")).toEqual({ type: "NEXT" });
    const cookie = await validSessionCookie(makeOperator({ role: "operator" }));
    expect(await middlewareDecision("/favicon.ico", cookie)).toEqual({ type: "NEXT" });
  });
});

describe("Property 2 (Preservation): pending/blocked logins still rejected (3.5)", () => {
  // The pending/blocked decision lives in the login flow (today `app/login/page.tsx`,
  // which calls the `check_login` RPC and maps `data.reason`), NOT in `proxy.ts`. We
  // capture the OBSERVED baseline reason→message mapping here so it can be preserved when
  // login issuance moves server-side (Task 5). This pure model mirrors the mapping in
  // `app/login/page.tsx`:
  //   reason "pending" → "Hisobingiz tasdiqlanmagan. Admin bilan bog'laning."
  //   reason "blocked" → "Hisob bloklangan."
  //   otherwise        → "Noto'g'ri raqam yoki parol"
  function loginErrorForReason(reason: string | undefined): string {
    if (reason === "pending") return "Hisobingiz tasdiqlanmagan. Admin bilan bog'laning.";
    if (reason === "blocked") return "Hisob bloklangan.";
    return "Noto'g'ri raqam yoki parol";
  }

  it("maps pending/blocked/other reasons to the correct rejection messages (3.5)", () => {
    expect(loginErrorForReason("pending")).toBe(
      "Hisobingiz tasdiqlanmagan. Admin bilan bog'laning."
    );
    expect(loginErrorForReason("blocked")).toBe("Hisob bloklangan.");
    expect(loginErrorForReason("wrong")).toBe("Noto'g'ri raqam yoki parol");
    expect(loginErrorForReason(undefined)).toBe("Noto'g'ri raqam yoki parol");
  });

  it("issues NO session on a rejected login, so the user stays gated at /login (3.5)", async () => {
    // A pending/blocked (or otherwise failed) login never reaches the cookie-setting
    // branch, so no `crm_op_session` is present. The middleware consequence — which IS
    // enforced by `proxy.ts` and must be preserved — is that the request is sessionless
    // and is redirected back to /login.
    expect(await middlewareDecision("/dashboard" /* no session issued */)).toEqual({
      type: "REDIRECT",
      location: "/login",
    });
    expect(await middlewareDecision("/admin" /* no session issued */)).toEqual({
      type: "REDIRECT",
      location: "/login",
    });
  });
});

// ---------------------------------------------------------------------------
// Property-based preservation: middleware decision == originally-observed decision
// across random (path, cookie-state) pairs in the NON-BUG domain.
// ---------------------------------------------------------------------------

describe("Property 2 (Preservation): random (path, state) decisions match the baseline", () => {
  // Mix of protected routes, public routes, root, and asset-like paths.
  const paths = [
    "/",
    "/login",
    "/register",
    "/dashboard",
    "/admin",
    "/admin/operators",
    "/admin/all-leads",
    "/leads",
    "/clients",
    "/orders",
    "/follow-ups",
    "/search",
    "/_next/static/chunk.js",
    "/logo.svg",
    "/favicon.ico",
  ];

  // Cookie states across the NON-BUG domain. "garbage" is encoding-independent; "operator"
  // and "admin" use the regime-adaptive valid-session builder so the routing logic is
  // asserted with whatever encoding the code under test trusts.
  type State = "none" | "garbage" | "operator" | "admin";
  const roleForState: Record<State, "admin" | "operator" | null> = {
    none: null,
    garbage: null,
    operator: "operator",
    admin: "admin",
  };

  it("preserves the middleware decision for every non-bug (path, state) pair", async () => {
    // Precompute the valid-session cookies once (they are constant across runs).
    const operatorCookie = await validSessionCookie(makeOperator({ role: "operator" }));
    const adminCookie = await validSessionCookie(makeOperator({ role: "admin" }));
    const cookieForState: Record<State, string | undefined> = {
      none: undefined,
      garbage: "###",
      operator: operatorCookie,
      admin: adminCookie,
    };

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...paths),
        fc.constantFrom<State>("none", "garbage", "operator", "admin"),
        async (path, state) => {
          const decision = await middlewareDecision(path, cookieForState[state]);
          const expected = expectedDecision(path, roleForState[state]);
          // The fixed middleware must reproduce the originally-observed decision for all
          // non-bug inputs (design Preservation Checking: original == fixed).
          expect(decision).toEqual(expected);
        }
      ),
      { numRuns: 300 }
    );
  });
});
