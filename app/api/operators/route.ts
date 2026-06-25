// Admin-only operator creation (Supabase Auth via SQL RPC).
//
// Authorization is enforced twice: (1) the server-verified session must be an admin, and
// (2) the `app_admin_create_operator` RPC itself re-checks auth.uid() is an admin. No
// service-role key is required.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerOperator } from "@/lib/auth-server";
import { isValidPhone } from "@/lib/phone";

export async function POST(request: Request) {
  const me = await getServerOperator();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ success: false, reason: "forbidden" }, { status: 403 });
  }

  let body: { phone?: unknown; name?: unknown; password?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === "admin" ? "admin" : "operator";

  if (!phoneRaw || !name || password.length < 6) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }
  if (!isValidPhone(phoneRaw)) {
    return NextResponse.json({ success: false, reason: "invalid_phone" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("app_admin_create_operator", {
    p_phone: phoneRaw,
    p_name: name,
    p_password: password,
    p_role: role,
  });

  if (error) {
    return NextResponse.json({ success: false, reason: "error" }, { status: 500 });
  }
  if (!data?.success) {
    const reason = data?.reason ?? "error";
    const status = reason === "forbidden" ? 403 : 400;
    return NextResponse.json({ success: false, reason }, { status });
  }

  return NextResponse.json({ success: true, id: data.id });
}
