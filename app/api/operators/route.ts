// Server-side admin operator creation route (Task 6.1).
//
// Replaces the previous client-side SHA-256 hashing in app/admin/operators/page.tsx so no
// password is ever hashed in the browser. Authorization is enforced here via the
// server-verified `crm_op_session` (verifySession) — only an admin session may create
// operators — and the RAW password is forwarded to the `admin_create_operator` RPC, which
// stores a slow, per-user-salted bcrypt hash via pgcrypto.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function POST(request: Request) {
  // Single authoritative enforcement path: trust only the verified crm_op_session.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json({ success: false, reason: "forbidden" }, { status: 403 });
  }

  let body: { phone?: unknown; name?: unknown; password?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === "admin" ? "admin" : "operator";

  if (!phone || !name || password.length < 6) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_create_operator", {
    p_phone: phone,
    p_name: name,
    p_password: password,
    p_role: role,
  });

  if (error) {
    return NextResponse.json({ success: false, reason: error.message }, { status: 500 });
  }

  if (!data?.success) {
    return NextResponse.json({ success: false, reason: data?.reason ?? "error" }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
