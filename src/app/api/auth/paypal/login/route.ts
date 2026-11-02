import { NextRequest, NextResponse } from "next/server";
import { generateOAuthState, STATE_COOKIE_NAME } from "@/domain/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // If request arrived via localhost, redirect to 127.0.0.1 so that the state cookie
  // and the PayPal return URL share the exact same host origin.
  if (request.nextUrl.hostname === "localhost") {
    const targetUrl = new URL(request.url);
    targetUrl.hostname = "127.0.0.1";
    return NextResponse.redirect(targetUrl);
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "PAYPAL_CLIENT_ID is not configured on server" },
      { status: 500 }
    );
  }

  const appUrl = (process.env.APP_URL || request.nextUrl.origin).replace("localhost", "127.0.0.1");
  const redirectUri = `${appUrl}/api/auth/paypal/callback`;
  const state = generateOAuthState();

  const isSandbox = (process.env.PAYPAL_ENV || "sandbox").toLowerCase() === "sandbox";
  const authorizeBaseUrl = isSandbox
    ? "https://www.sandbox.paypal.com/signin/authorize"
    : "https://www.paypal.com/signin/authorize";

  const searchParams = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: redirectUri,
    state,
  });

  const authorizeUrl = `${authorizeBaseUrl}?${searchParams.toString()}`;

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}

