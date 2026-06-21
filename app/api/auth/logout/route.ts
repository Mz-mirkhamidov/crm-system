// Server-side logout route handler (Task 5.3).
//
// Clears the server-issued `crm_op_session` cookie by overwriting it with an expired
// (maxAge 0) HttpOnly cookie. After logout, subsequent protected-route access is
// sessionless and `proxy.ts` redirects to `/login`.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
