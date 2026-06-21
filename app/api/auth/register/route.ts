// Server-side self-registration route handler (Task 6.1).
//
// Mirrors the login route: the browser submits the RAW phone/name/password over HTTPS and
// this Node-runtime handler forwards the raw password to the Supabase `register_operator`
// RPC, where pgcrypto stores a slow, per-user-salted bcrypt hash. No password is hashed in
// the browser anymore. Returns the same `{ success, reason }` shape the register page
// already understands (reason: "exists" when the phone is taken).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { phone?: unknown; name?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!phone || !name || password.length < 6) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("register_operator", {
    p_phone: phone,
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

  return NextResponse.json({ success: true, id: data.id });
}
