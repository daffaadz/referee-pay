import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE, createSessionToken } from "@/domain/session";
import { upsertSeller } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "Demo sign in is disabled in non-demo mode" },
      { status: 403 }
    );
  }

  const demoSeller = await upsertSeller({
    paypalSub: "demo_seller_sub_12345",
    email: "sari.demo@example.com",
    name: "Sari (Demo Seller)",
    emailVerified: true,
  });

  const sessionToken = await createSessionToken({
    sellerId: demoSeller.id,
    email: demoSeller.email,
    name: demoSeller.name,
  });

  const redirectUrl = request.nextUrl.searchParams.get("redirect") || "/dashboard";
  const response = NextResponse.redirect(new URL(redirectUrl, request.url));

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}

export async function POST() {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "Demo sign in is disabled in non-demo mode" },
      { status: 403 }
    );
  }

  const demoSeller = await upsertSeller({
    paypalSub: "demo_seller_sub_12345",
    email: "sari.demo@example.com",
    name: "Sari (Demo Seller)",
    emailVerified: true,
  });

  const sessionToken = await createSessionToken({
    sellerId: demoSeller.id,
    email: demoSeller.email,
    name: demoSeller.name,
  });

  const response = NextResponse.json({
    ok: true,
    seller: {
      id: demoSeller.id,
      email: demoSeller.email,
      name: demoSeller.name,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
