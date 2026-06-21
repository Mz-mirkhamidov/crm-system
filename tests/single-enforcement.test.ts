// Task 5.5 — Single Authoritative Enforcement Path (Property 4)
// Spec: auth-session-security-fix
//
// Property 4 — Single authoritative enforcement path:
//   For any protected route, access control is decided by EXACTLY ONE mechanism — the
//   server-validated `crm_op_session` verified in `proxy.ts`. No decision depends on the
//   removed `crm_session`/`"authenticated"` mechanism (formerly in `lib/auth.ts`).
//
// ============================================================================
// EXPECTED OUTCOME: **THESE TESTS PASS** on the fixed code (post Task 5).
// ============================================================================
// Two complementary checks:
//   1. STATIC: a grep-style scan of the ACTIVE app source asserts that no module imports
//      `@/lib/auth` or references the removed `crm_session` cookie / `SESSION_VALUE`
//      ("authenticated") / hardcoded `CRM_EMAIL` / `CRM_PASSWORD` constants.
//   2. DECISION-TABLE: the middleware (`proxy.ts`) decides access solely from the verified
//      `crm_op_session`. Presence or absence of a (legacy) `crm_session=authenticated`
//      cookie has NO effect on any decision.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import fc from "fast-check";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE, type Operator } from "@/lib/session";
import { signTestSession, forgeUnsignedSession, makeOperator } from "./helpers/session-helper";

const ORIGIN = "http://localhost";
const REPO_ROOT = process.cwd();

// Directories that are NOT part of the active application build and are therefore out of
// scope for the single-enforcement guarantee.
//   - tests: this suite (and the spec helpers) deliberately mention `crm_session` in prose.
//   - patch: stale duplicates excluded from tsconfig (they also import a non-existent
//            `@/types`); not part of the active app.
//   - .kiro: spec/design documents.
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "tests",
  "patch",
  ".kiro",
  "public",
  "supabase",
]);

/** Recursively collect `.ts`/`.tsx` source files under the active app. */
function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

type Decision = { type: "REDIRECT"; location: string } | { type: "NEXT" };

/** Run a path through `proxy.ts` with an arbitrary set of cookies. */
async function middlewareDecision(
  path: string,
  cookies: Record<string, string> = {}
): Promise<Decision> {
  const req = new NextRequest(new URL(path, ORIGIN));
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  const res = await proxy(req);
  const location = res.headers.get("location");
  if (location) {
    return { type: "REDIRECT", location: new URL(location, ORIGIN).pathname };
  }
  return { type: "NEXT" };
}

// ---------------------------------------------------------------------------
// 1. Static check: the removed mechanism is gone from the active app source.
// ---------------------------------------------------------------------------

describe("Property 4 (Single Enforcement): removed mechanism absent from active source", () => {
  const sourceFiles = collectSourceFiles(REPO_ROOT);

  it("finds active application source files to scan", () => {
    // Sanity: the walker must actually be inspecting the app (proxy.ts, lib, app, …).
    expect(sourceFiles.length).toBeGreaterThan(0);
    const rels = sourceFiles.map((f) => relative(REPO_ROOT, f));
    expect(rels).toContain("proxy.ts");
  });

  it("no active source imports the deleted `@/lib/auth` module", () => {
    const offenders = sourceFiles.filter((f) =>
      /from\s+["']@\/lib\/auth["']/.test(readFileSync(f, "utf-8"))
    );
    expect(offenders.map((f) => relative(REPO_ROOT, f))).toEqual([]);
  });

  it("no active source references the removed `crm_session` cookie or its constants", () => {
    // `crm_session` is distinct from the live `crm_op_session` cookie and is NOT a
    // substring of it, so a plain `includes` is safe and specific.
    const forbidden = ["crm_session", "SESSION_VALUE", "CRM_EMAIL", "CRM_PASSWORD"];
    const offenders: string[] = [];
    for (const f of sourceFiles) {
      const content = readFileSync(f, "utf-8");
      for (const token of forbidden) {
        if (content.includes(token)) {
          offenders.push(`${relative(REPO_ROOT, f)} :: ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the live session cookie name is exactly `crm_op_session`", () => {
    // Guards against accidental reintroduction of the legacy cookie name.
    expect(SESSION_COOKIE).toBe("crm_op_session");
  });
});

// ---------------------------------------------------------------------------
// 2. Decision-table: only the verified `crm_op_session` decides access.
// ---------------------------------------------------------------------------

describe("Property 4 (Single Enforcement): only verified crm_op_session decides access", () => {
  it("grants /admin ONLY for a verified admin crm_op_session", async () => {
    const adminCookie = await signTestSession(makeOperator({ role: "admin" }));
    expect(await middlewareDecision("/admin", { [SESSION_COOKIE]: adminCookie })).toEqual({
      type: "NEXT",
    });
  });

  it("blocks operators from /admin and serves their /dashboard (verified session only)", async () => {
    const opCookie = await signTestSession(makeOperator({ role: "operator" }));
    expect(await middlewareDecision("/admin", { [SESSION_COOKIE]: opCookie })).toEqual({
      type: "REDIRECT",
      location: "/dashboard",
    });
    expect(await middlewareDecision("/dashboard", { [SESSION_COOKIE]: opCookie })).toEqual({
      type: "NEXT",
    });
  });

  it("a legacy `crm_session=authenticated` cookie grants NOTHING on its own", async () => {
    // The removed mechanism must be inert: with no valid crm_op_session, every protected
    // route is sessionless → /login, exactly as if the cookie were absent.
    for (const path of ["/", "/admin", "/dashboard", "/leads", "/orders"]) {
      expect(await middlewareDecision(path, { crm_session: "authenticated" })).toEqual({
        type: "REDIRECT",
        location: "/login",
      });
    }
  });

  it("a legacy `crm_session` cookie cannot rescue a forged/unsigned crm_op_session", async () => {
    const forgedAdmin = forgeUnsignedSession({ id: "x", name: "x", phone: "x", role: "admin" });
    expect(
      await middlewareDecision("/admin", {
        [SESSION_COOKIE]: forgedAdmin,
        crm_session: "authenticated",
      })
    ).toEqual({ type: "REDIRECT", location: "/login" });
  });

  it("the decision is INVARIANT to the presence of a legacy crm_session cookie", async () => {
    // For any (path, role-state), the decision with and without an extra crm_session
    // cookie must be identical — proving crm_session contributes nothing to the decision.
    const adminCookie = await signTestSession(makeOperator({ role: "admin" }));
    const opCookie = await signTestSession(makeOperator({ role: "operator" }));
    const paths = ["/", "/login", "/register", "/admin", "/admin/operators", "/dashboard", "/leads"];

    type State = "none" | "operator" | "admin";
    const cookieForState: Record<State, Record<string, string>> = {
      none: {},
      operator: { [SESSION_COOKIE]: opCookie },
      admin: { [SESSION_COOKIE]: adminCookie },
    };

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...paths),
        fc.constantFrom<State>("none", "operator", "admin"),
        async (path, state) => {
          const base = cookieForState[state];
          const withLegacy = { ...base, crm_session: "authenticated" };
          const a = await middlewareDecision(path, base);
          const b = await middlewareDecision(path, withLegacy);
          expect(b).toEqual(a);
        }
      ),
      { numRuns: 150 }
    );
  });
});
