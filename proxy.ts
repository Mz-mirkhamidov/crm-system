import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 proxy (formerly "middleware"). Validates the Supabase Auth session on every
 * navigation, refreshes its cookies, and gates routes by role. API routes and static assets
 * are passed through untouched (the API routes do their own auth).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through API routes, Next internals, and static files.
  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata?.role as string) ?? "operator";
  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Not logged in
  if (!user) {
    if (isAuthPage) return response;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged in but on an auth page -> go to the right panel
  if (isAuthPage) {
    return NextResponse.redirect(
      new URL(role === "admin" ? "/admin" : "/dashboard", request.url)
    );
  }

  // Operators cannot access the admin area
  if (role !== "admin" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Root -> panel
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(role === "admin" ? "/admin" : "/dashboard", request.url)
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
