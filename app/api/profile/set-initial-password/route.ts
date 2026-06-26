// First-login password setup. The user is already authenticated (e.g. signed in with a
// temporary password) and flagged `must_change_password`. They choose a permanent password
// here; we update it and clear the flag.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerOperator } from "@/lib/auth-server";

export async function POST(request: Request) {
  const me = await getServerOperator();
  if (!me) return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });

  let body: { newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 6) {
    return NextResponse.json({ success: false, reason: "weak" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return NextResponse.json({ success: false, reason: "error" }, { status: 500 });
  }
  await supabase.from("operators").update({ must_change_password: false }).eq("id", me.id);

  return NextResponse.json({ success: true, role: me.role });
}
