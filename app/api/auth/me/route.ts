// Server-verified identity endpoint (Task 5.3).
//
// Returns the Operator carried by the server-issued `crm_op_session` cookie, but ONLY
// after verifying its HMAC signature and expiry via `verifySession`. Because the cookie
// is HttpOnly the browser can no longer read it directly; client components obtain their
// identity from this endpoint so the displayed identity is always the server-verified one
// (design Fix Implementation change 4). Returns 401 with a null body when there is no
// valid session.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const operator = token ? await verifySession(token) : null;

  if (!operator) {
    return NextResponse.json(null, { status: 401 });
  }

  return NextResponse.json(operator);
}
