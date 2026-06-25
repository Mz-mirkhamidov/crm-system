// Update the current user's display name (server-verified session required).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerOperator } from "@/lib/auth-server";

export async function POST(request: Request) {
  const me = await getServerOperator();
  if (!me) return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("operators").update({ name }).eq("id", me.id);
  if (error) return NextResponse.json({ success: false, reason: "error" }, { status: 500 });

  // Keep the auth user metadata in sync.
  await supabase.auth.updateUser({ data: { name } });

  return NextResponse.json({ success: true, name });
}
