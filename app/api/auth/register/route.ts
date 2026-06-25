// Server-side open registration (Supabase Auth via SQL RPC).
//
// Uses the `app_register_operator` SECURITY DEFINER function to create a fully-confirmed,
// immediately-active user with ONLY the public anon key — no service-role key required.
// The `operators` profile row is created by the on_auth_user_created DB trigger. After
// creation we sign the user in so they land straight in the app.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { phoneToEmail, isValidPhone } from "@/lib/phone";

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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("app_register_operator", {
    p_phone: phoneRaw,
    p_name: name,
    p_password: password,
  });

  if (error) {
    return NextResponse.json({ success: false, reason: "error" }, { status: 500 });
  }
  if (!data?.success) {
    const reason = data?.reason ?? "error";
    return NextResponse.json({ success: false, reason }, { status: 400 });
  }

  // Open registration is immediately active — sign the new user in.
  await supabase.auth.signInWithPassword({ email: phoneToEmail(phoneRaw), password });

  return NextResponse.json({ success: true, role: "operator" });
}
