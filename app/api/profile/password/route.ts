// Change the current user's password. Requires the current password (re-verified) and a
// valid server session.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerOperator } from "@/lib/auth-server";
import { phoneToEmail } from "@/lib/phone";

export async function POST(request: Request) {
  const me = await getServerOperator();
  if (!me) return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 6) {
    return NextResponse.json({ success: false, reason: "weak" }, { status: 400 });
  }

  const supabase = await createClient();

  // Re-verify the current password before allowing a change.
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(me.phone),
    password: currentPassword,
  });
  if (verifyErr) {
    return NextResponse.json({ success: false, reason: "wrong_current" }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("different") || msg.includes("same")) {
      return NextResponse.json({ success: false, reason: "same" }, { status: 400 });
    }
    return NextResponse.json({ success: false, reason: "error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
