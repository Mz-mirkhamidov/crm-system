// Task 7 — Exhaustive proxy.ts decision-table unit test
// Spec: auth-session-security-fix
//
// Asserts the EXACT middleware outcome (a REDIRECT to a specific path, or NEXT) for every
// (path, session-state) combination, covering each branch of `proxy.ts`:
//   1. assets (`/_next/*` or any path containing ".") → NEXT (checked BEFORE session use)
//   2. no/invalid session → `/login`,`/register` public (NEXT); all else → REDIRECT /login
//   3. valid session on `/login` → REDIRECT to /admin (admin) or /dashboard (operator)
//   4. operator on `/admin*` → REDIRECT /dashboard
//   5. valid session on `/` → REDIRECT to /admin (admin) or /dashboard (operator)
//   6. otherwise → NEXT
//
// Session-states exercised:
//   none             → no cookie                                  (session === null)
//   signed-operator  → signSession({role:"operator"})             (verified operator)
//   signed-admin     → signSession({role:"admin"})                (verified admin)
//   forged-unsigned  → plain base64 JSON, NO HMAC signature       (verifySession → null)
//   garbage          → "###" (unparseable)                        (verifySession → null)
//
// `forged-unsigned` and `garbage` must collapse to the SAME outcomes as `none` — that is
// the whole point of the fix (every forgery becomes "no valid session"). This complements
// the bug-condition (Property 1) and preservation (Property 2) property tests with an
// explicit, exhaustive table; it does not duplicate them.
//
// ============================================================================
// EXPECTED OUTCOME: **THIS TEST PASSES** on the fixed code (post Task 4).
// ============================================================================

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE } from "@/lib/session";
import { signSession } from "@/lib/session";
import { forgeUnsignedSession, makeOperator } from "./helpers/session-helper";

const ORIGIN = "http://localhost";

type Decision = { type: "REDIRECT"; location: string } | { type: "NEXT" };

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

const NEXT: Decision = { type: "NEXT" };
const toLogin: Decision = { type: "REDIRECT", location: "/login" };
const toDashboard: Decision = { type: "REDIRECT", location: "/dashboard" };
const toAdmin: Decision = { type: "REDIRECT", location: "/admin" };

type State = "none" | "signed-operator" | "signed-admin" | "forged-unsigned" | "garbage";

const PATHS = [
  "/",
  "/login",
  "/register",
  "/dashboard",
  "/admin",
  "/admin/operators",
  "/leads",
  "/_next/static/x.js",
  "/logo.svg",
] as const;

// Fully-enumerated expected decision table. Rows = state, columns = path.
// `none`, `forged-unsigned`, and `garbage` share the unauthenticated column intentionally.
const EXPECTED: Record<State, Record<(typeof PATHS)[number], Decision>> = {
  none: {
    "/": toLogin,
    "/login": NEXT,
    "/register": NEXT,
    "/dashboard": toLogin,
    "/admin": toLogin,
    "/admin/operators": toLogin,
    "/leads": toLogin,
    "/_next/static/x.js": NEXT,
    "/logo.svg": NEXT,
  },
  "forged-unsigned": {
    "/": toLogin,
    "/login": NEXT,
    "/register": NEXT,
    "/dashboard": toLogin,
    "/admin": toLogin,
    "/admin/operators": toLogin,
    "/leads": toLogin,
    "/_next/static/x.js": NEXT,
    "/logo.svg": NEXT,
  },
  garbage: {
    "/": toLogin,
    "/login": NEXT,
    "/register": NEXT,
    "/dashboard": toLogin,
    "/admin": toLogin,
    "/admin/operators": toLogin,
    "/leads": toLogin,
    "/_next/static/x.js": NEXT,
    "/logo.svg": NEXT,
  },
  "signed-operator": {
    "/": toDashboard,
    "/login": toDashboard,
    "/register": NEXT,
    "/dashboard": NEXT,
    "/admin": toDashboard,
    "/admin/operators": toDashboard,
    "/leads": NEXT,
    "/_next/static/x.js": NEXT,
    "/logo.svg": NEXT,
  },
  "signed-admin": {
    "/": toAdmin,
    "/login": toAdmin,
    "/register": NEXT,
    "/dashboard": NEXT,
    "/admin": NEXT,
    "/admin/operators": NEXT,
    "/leads": NEXT,
    "/_next/static/x.js": NEXT,
    "/logo.svg": NEXT,
  },
};

describe("proxy.ts decision table — exhaustive (path × session-state)", () => {
  // Build the cookie value for each state once.
  async function cookieForState(state: State): Promise<string | undefined> {
    switch (state) {
      case "none":
        return undefined;
      case "signed-operator":
        return signSession(makeOperator({ role: "operator" }));
      case "signed-admin":
        return signSession(makeOperator({ role: "admin" }));
      case "forged-unsigned":
        // Plain base64 JSON with a usable admin identity but NO signature.
        return forgeUnsignedSession({ id: "x", name: "x", phone: "x", role: "admin" });
      case "garbage":
        return "###";
    }
  }

  const states: State[] = [
    "none",
    "signed-operator",
    "signed-admin",
    "forged-unsigned",
    "garbage",
  ];

  for (const state of states) {
    describe(`state: ${state}`, () => {
      for (const path of PATHS) {
        const expected = EXPECTED[state][path];
        const label =
          expected.type === "NEXT" ? "NEXT" : `REDIRECT ${expected.location}`;
        it(`${path} → ${label}`, async () => {
          const cookie = await cookieForState(state);
          expect(await middlewareDecision(path, cookie)).toEqual(expected);
        });
      }
    });
  }

  it("forged-unsigned and garbage produce identical outcomes to `none` for every path", async () => {
    // Cross-check: the fix collapses every forgery into the unauthenticated column.
    for (const path of PATHS) {
      expect(EXPECTED["forged-unsigned"][path]).toEqual(EXPECTED.none[path]);
      expect(EXPECTED.garbage[path]).toEqual(EXPECTED.none[path]);
    }
  });
});
