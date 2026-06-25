// Admin-only operator creation (Supabase Auth).
//
// Authorization is enforced from the server-verified Supabase session: only an admin may
// create operators. The new user is created fully-confirmed and active via the Auth admin
// API; the `operators` profile row is created by the DB trigger from the user metadata.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerOperator } from "@/lib/auth-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneToEmail, normalizePhone, isValidPhone } from "@/lib/phone";

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

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ success: false, reason: "error" }, { status: 500 });
  }

  const email = phoneToEmail(phoneRaw);
  const phone = `+${normalizePhone(phoneRaw)}`;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone },
    app_metadata: { role, provider: "email", providers: ["email"] },
  });

  if (error || !created.user) {
    const msg = error?.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
      return NextResponse.json({ success: false, reason: "exists" }, { status: 400 });
    }
    return NextResponse.json({ success: false, reason: error?.message ?? "error" }, { status: 500 });
  }

  // Trigger sets role from app_metadata; ensure admin role is reflected defensively.
  if (role === "admin") {
    await admin.from("operators").update({ role: "admin" }).eq("id", created.user.id);
  }

  return NextResponse.json({ success: true, id: created.user.id });
}
