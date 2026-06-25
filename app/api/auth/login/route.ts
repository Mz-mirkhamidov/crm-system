// Server-side login (Supabase Auth).
//
// The browser submits phone + password. We map the phone to the internal synthetic email
// (lib/phone) and call Supabase `signInWithPassword`, which — via the @supabase/ssr cookie
// adapter — sets the secure HttpOnly auth cookies. We then enforce the profile's
// active/blocked status before reporting success. No password handling happens in the
// browser.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { phoneToEmail } from "@/lib/phone";

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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password,
  });

  if (error || !data.user) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 401 });
  }

  // Enforce profile status (blocked / pending) — sign back out if not allowed.
  const { data: profile } = await supabase
    .from("operators")
    .select("role, status, is_active")
    .eq("id", data.user.id)
    .single();

  if (profile?.status === "blocked" || profile?.is_active === false) {
    await supabase.auth.signOut();
    return NextResponse.json({ success: false, reason: "blocked" }, { status: 403 });
  }
  if (profile?.status === "pending") {
    await supabase.auth.signOut();
    return NextResponse.json({ success: false, reason: "pending" }, { status: 403 });
  }

  const role =
    (profile?.role as string) ?? (data.user.app_metadata?.role as string) ?? "operator";
  return NextResponse.json({ success: true, role });
}
