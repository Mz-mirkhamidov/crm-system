// Task 7 — Integration tests for the auth route handlers + middleware
// Spec: auth-session-security-fix
//
// Drives the EXPORTED route handlers directly (there is no live Next server or DB in this
// environment) with constructed Request objects, mocking the Supabase server client so
// `check_login` returns controlled results, and mocking `next/headers` `cookies()` for the
// `/api/auth/me` endpoint. Covers the design Testing Strategy → Integration Tests:
//   - login success → server-issued HttpOnly/Secure/SameSite cookie that verifySession
//     accepts and round-trips to the operator
//   - login pending/blocked → 403 with the reason, no cookie set
//   - login wrong creds → 401, no cookie
//   - logout → Set-Cookie clears crm_op_session (Max-Age=0)
//   - /api/auth/me → 200 + operator for a valid cookie; 401 + null for none/forged
//   - attacker flow: forged admin cookie through proxy() → /admin redirects to /login
//   - operator session cannot reach /admin while an admin session can
//
// ============================================================================
// EXPECTED OUTCOME: **THESE TESTS PASS** on the fixed code (post Tasks 4 & 5).
// ============================================================================
//
// MOCKING CAVEATS (also reported back to the orchestrator):
//   - `@/lib/supabase/server` `createClient` is replaced with a stub exposing a
//     controllable `rpc` mock, so no live Supabase/DB is needed. `rpc` resolves to
//     `{ data, error }` exactly as `@supabase/ssr` would.
//   - `app/api/auth/me/route.ts` reads the cookie via `next/headers` `cookies()`, which
//     cannot observe a directly-constructed Request. We therefore mock `cookies()` to
//     return the token under test (the design's preferred approach), so the `me` handler
//     is exercised end-to-end against the real `verifySession`.
//   - The login/logout handlers set cookies on the NextResponse, so we read them from
//     `response.cookies` and the `Set-Cookie` header without needing `next/headers`.

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mock fns (initialized before vi.mock factories run) -------------------
const { rpcMock, cookieGetMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  cookieGetMock: vi.fn(),
}));

// Mock the Supabase server client: createClient() → { rpc }.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

// Mock next/headers cookies() for the `me` endpoint.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => cookieGetMock(name),
  })),
}));

import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import { GET as meGET } from "@/app/api/auth/me/route";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE, verifySession, signSession } from "@/lib/session";
import { forgeUnsignedSession, makeOperator } from "./helpers/session-helper";

const ORIGIN = "http://localhost";

function loginRequest(body: unknown): Request {
  return new Request(`${ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  rpcMock.mockReset();
  cookieGetMock.mockReset();
});

// ---------------------------------------------------------------------------
// Login route
// ---------------------------------------------------------------------------

describe("integration: POST /api/auth/login", () => {
  it("on valid credentials sets a signed HttpOnly/Secure/SameSite cookie and returns the role", async () => {
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        id: "op-77",
        name: "Valid Operator",
        phone: "+998901234567",
        role: "operator",
      },
      error: null,
    });

    const res = await loginPOST(loginRequest({ phone: "+998901234567", password: "s3cret" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, role: "operator" });

    // The server forwarded the RAW password to check_login (no client-side hashing).
    expect(rpcMock).toHaveBeenCalledWith("check_login", {
      p_phone: "+998901234567",
      p_password: "s3cret",
    });

    // A crm_op_session cookie is set and verifies / round-trips to the operator.
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/crm_op_session=/);
    expect(setCookie).toMatch(/httponly/i);
    expect(setCookie).toMatch(/secure/i);
    expect(setCookie).toMatch(/samesite=lax/i);
    expect(setCookie).toMatch(/max-age=2592000/i);

    const token = res.cookies.get(SESSION_COOKIE)?.value ?? "";
    expect(token).not.toBe("");
    const verified = await verifySession(token);
    expect(verified).toEqual({
      id: "op-77",
      name: "Valid Operator",
      phone: "+998901234567",
      role: "operator",
    });
  });

  it("signs an admin session for an admin login", async () => {
    rpcMock.mockResolvedValue({
      data: { success: true, id: "admin-1", name: "Boss", phone: "+998900000000", role: "admin" },
      error: null,
    });

    const res = await loginPOST(loginRequest({ phone: "+998900000000", password: "pw" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, role: "admin" });

    const token = res.cookies.get(SESSION_COOKIE)?.value ?? "";
    expect((await verifySession(token))?.role).toBe("admin");
  });

  it("rejects a pending account with 403 and the `pending` reason, setting no cookie", async () => {
    rpcMock.mockResolvedValue({ data: { success: false, reason: "pending" }, error: null });

    const res = await loginPOST(loginRequest({ phone: "+998901234567", password: "pw" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ success: false, reason: "pending" });
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("rejects a blocked account with 403 and the `blocked` reason, setting no cookie", async () => {
    rpcMock.mockResolvedValue({ data: { success: false, reason: "blocked" }, error: null });

    const res = await loginPOST(loginRequest({ phone: "+998901234567", password: "pw" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ success: false, reason: "blocked" });
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("rejects wrong credentials with 401 and no cookie", async () => {
    rpcMock.mockResolvedValue({ data: { success: false, reason: "not_found" }, error: null });

    const res = await loginPOST(loginRequest({ phone: "+998900000000", password: "wrong" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, reason: "not_found" });
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("maps an RPC/transport error to 500 with reason `error` and no cookie", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "db down" } });

    const res = await loginPOST(loginRequest({ phone: "+998900000000", password: "pw" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, reason: "error" });
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Logout route
// ---------------------------------------------------------------------------

describe("integration: POST /api/auth/logout", () => {
  it("clears the crm_op_session cookie (empty value, Max-Age=0)", async () => {
    const res = await logoutPOST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/crm_op_session=;|crm_op_session=\s*;/i);
    expect(setCookie).toMatch(/max-age=0/i);

    // The cleared cookie carries no usable session.
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe("");
  });

  it("after logout, a sessionless protected request redirects to /login", async () => {
    // The logout response clears the cookie; a subsequent request with no valid session
    // is gated by proxy.ts back to /login.
    const decision = await runProxy("/dashboard" /* no cookie */);
    expect(decision).toEqual({ type: "REDIRECT", location: "/login" });
  });
});

// ---------------------------------------------------------------------------
// /api/auth/me endpoint
// ---------------------------------------------------------------------------

describe("integration: GET /api/auth/me", () => {
  it("returns 200 and the operator JSON for a valid signed cookie", async () => {
    const op = makeOperator({ id: "me-1", name: "Me", role: "operator" });
    const token = await signSession(op);
    cookieGetMock.mockReturnValue({ value: token });

    const res = await meGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "me-1",
      name: "Me",
      phone: op.phone,
      role: "operator",
    });
  });

  it("returns 401 and null when there is no session cookie", async () => {
    cookieGetMock.mockReturnValue(undefined);

    const res = await meGET();
    expect(res.status).toBe(401);
    expect(await res.json()).toBeNull();
  });

  it("returns 401 and null for a forged (unsigned) cookie", async () => {
    const forged = forgeUnsignedSession({ id: "x", name: "x", phone: "x", role: "admin" });
    cookieGetMock.mockReturnValue({ value: forged });

    const res = await meGET();
    expect(res.status).toBe(401);
    expect(await res.json()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Attacker flow + role separation through the middleware
// ---------------------------------------------------------------------------

type Decision = { type: "REDIRECT"; location: string } | { type: "NEXT" };

async function runProxy(path: string, cookieValue?: string): Promise<Decision> {
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

describe("integration: attacker flow & role separation via proxy()", () => {
  it("a forged admin cookie injected into a request is redirected from /admin to /login", async () => {
    const forgedAdmin = forgeUnsignedSession({ id: "x", name: "x", phone: "x", role: "admin" });
    expect(await runProxy("/admin", forgedAdmin)).toEqual({
      type: "REDIRECT",
      location: "/login",
    });
    // No admin content for any admin sub-route either.
    expect(await runProxy("/admin/operators", forgedAdmin)).toEqual({
      type: "REDIRECT",
      location: "/login",
    });
  });

  it("an operator session cannot reach /admin (redirected to /dashboard) while an admin can", async () => {
    const operatorToken = await signSession(makeOperator({ role: "operator" }));
    const adminToken = await signSession(makeOperator({ role: "admin" }));

    // Operator is blocked from /admin and served their dashboard.
    expect(await runProxy("/admin", operatorToken)).toEqual({
      type: "REDIRECT",
      location: "/dashboard",
    });
    expect(await runProxy("/dashboard", operatorToken)).toEqual({ type: "NEXT" });

    // Admin reaches /admin.
    expect(await runProxy("/admin", adminToken)).toEqual({ type: "NEXT" });
    expect(await runProxy("/admin/operators", adminToken)).toEqual({ type: "NEXT" });
  });

  it("end-to-end: login-issued cookie is accepted by the middleware on a protected route", async () => {
    // Issue a session exactly as the login route does, then route a protected request
    // bearing that cookie — it must be served (NEXT), not redirected.
    rpcMock.mockResolvedValue({
      data: { success: true, id: "e2e-1", name: "E2E", phone: "+998901112233", role: "operator" },
      error: null,
    });
    const loginRes = await loginPOST(loginRequest({ phone: "+998901112233", password: "pw" }));
    const token = loginRes.cookies.get(SESSION_COOKIE)?.value ?? "";
    expect(token).not.toBe("");

    expect(await runProxy("/dashboard", token)).toEqual({ type: "NEXT" });
    // And the operator still cannot reach /admin with that issued cookie.
    expect(await runProxy("/admin", token)).toEqual({
      type: "REDIRECT",
      location: "/dashboard",
    });
  });
});
