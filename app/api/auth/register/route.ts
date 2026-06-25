// Server-side open registration (Supabase Auth).
//
// Creates a fully-confirmed, immediately-active user via the Auth admin API (service role),
// then signs them in so they land straight in the app. The `operators` profile row is
// created automatically by the `on_auth_user_created` DB trigger from the user metadata.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneToEmail, normalizePhone, isValidPhone } from "@/lib/phone";

export async function POST(request: Request) {
  let body: { phone?: unknown; name?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!phoneRaw || !name || password.length < 6) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }
  if (!isValidPhone(phoneRaw)) {
    return NextResponse.json({ success: false, reason: "invalid_phone" }, { status: 400 });
  }

  const email = phoneToEmail(phoneRaw);
  const phone = `+${normalizePhone(phoneRaw)}`;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ success: false, reason: "error" }, { status: 500 });
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone },
    app_metadata: { role: "operator", provider: "email", providers: ["email"] },
  });

  if (error || !created.user) {
    const msg = error?.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
      return NextResponse.json({ success: false, reason: "exists" }, { status: 400 });
    }
    return NextResponse.json({ success: false, reason: "error" }, { status: 500 });
  }

  // Auto sign-in: open registration is immediately active.
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });

  return NextResponse.json({ success: true, role: "operator" });
}
