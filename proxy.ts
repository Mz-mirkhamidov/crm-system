import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieVal = request.cookies.get(SESSION_COOKIE)?.value;
  const session = cookieVal ? await verifySession(cookieVal) : null;

  // Static & assets
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Not logged in → login
  if (!session) {
    if (pathname === "/login" || pathname === "/register") return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged in → don't show login
  if (pathname === "/login") {
    return NextResponse.redirect(
      new URL(session.role === "admin" ? "/admin" : "/dashboard", request.url)
    );
  }

  // Operator tries admin → block
  if (session.role === "operator" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Root → redirect
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(session.role === "admin" ? "/admin" : "/dashboard", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
