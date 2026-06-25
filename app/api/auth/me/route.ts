// Server-verified identity endpoint. Returns the current Operator from the Supabase Auth
// session enriched with the profile row, or 401 when there is no valid session.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerOperator } from "@/lib/auth-server";

export async function GET() {
  const operator = await getServerOperator();
  if (!operator) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(operator);
}
