import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/domain/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /dashboard and /dashboard/*
  if (pathname.startsWith("/dashboard")) {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionToken ? await verifySessionToken(sessionToken) : null;

    if (!session) {
      if (process.env.DEMO_MODE === "true") {
        return NextResponse.redirect(new URL("/api/auth/demo?redirect=/dashboard", request.url));
      }
      return NextResponse.redirect(new URL("/?login=required", request.url));
    }
  }

  // Protect /api/seller/* except /api/seller/me which handles its own unauthenticated state
  if (pathname.startsWith("/api/seller") && pathname !== "/api/seller/me") {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionToken ? await verifySessionToken(sessionToken) : null;

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required: Please sign in with PayPal" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/seller/:path*"],
};

