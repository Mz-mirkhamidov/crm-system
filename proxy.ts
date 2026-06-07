import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_VALUE } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE);
  const isAuth = session?.value === SESSION_VALUE;

  // Login sahifasida authenticated bo'lsa → dashboard
  if (isAuth && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Dashboard sahifalarida auth yo'q → login
  if (!isAuth && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
