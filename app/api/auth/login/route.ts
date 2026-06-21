// Server-side login route handler (Task 5.1, hashing hardened in Task 6.1).
//
// Moves session issuance to the server so the browser can no longer mint or mutate
// `crm_op_session`. The handler validates credentials via the Supabase `check_login`
// RPC, and on success signs an HMAC-protected session token (`signSession`) and sets it
// as an HttpOnly / Secure / SameSite cookie. This closes the client-side cookie-minting
// boundary identified as a root cause (design Fix Implementation change 4).
//
// Runs in the Node runtime: the RAW password is forwarded over the server (TLS) boundary
// to the `check_login` RPC, where pgcrypto performs slow, per-user-salted bcrypt
// verification (with transparent re-hash of any legacy SHA-256 rows). No password hashing
// happens in the browser or inside `proxy.ts` (the Edge path).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  type Operator,
} from "@/lib/session";

export async function POST(request: Request) {
  let body: { phone?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!phone || !password) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();

  // Forward the RAW password over the server (TLS) boundary; pgcrypto verifies it with
  // slow, per-user-salted bcrypt (and transparently re-hashes legacy SHA-256 rows).
  const { data, error } = await supabase.rpc("check_login", {
    p_phone: phone,
    p_password: password,
  });

  // RPC/transport failure → preserve the "Tizim xatosi" path the client maps from `error`.
  if (error) {
    return NextResponse.json({ success: false, reason: "error" }, { status: 500 });
  }

  if (!data?.success) {
    // Preserve the pending / blocked / invalid reasons so the client shows the same
    // messages (design Preservation 3.5).
    const reason = data?.reason ?? "invalid";
    const status = reason === "pending" || reason === "blocked" ? 403 : 401;
    return NextResponse.json({ success: false, reason }, { status });
  }

  const operator: Operator = {
    id: data.id,
    name: data.name,
    phone: data.phone,
    role: data.role,
  };

  const token = await signSession(operator);

  const response = NextResponse.json({ success: true, role: operator.role });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
