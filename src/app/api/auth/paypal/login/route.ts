import { NextRequest, NextResponse } from "next/server";
import { generateOAuthState, STATE_COOKIE_NAME } from "@/domain/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Check client host from Host header or request.nextUrl
  const clientHost = request.headers.get("host") || request.nextUrl.host || "";
  const isExplicit127 = clientHost.includes("127.0.0.1") || request.nextUrl.hostname === "127.0.0.1";

  // In development, if the request arrived via localhost, redirect once to 127.0.0.1
  // so that the state cookie and the PayPal return URL share the exact same host origin.
  // Never redirect if already on 127.0.0.1 to avoid infinite redirect loops.
  if (!isExplicit127 && (clientHost.startsWith("localhost") || request.nextUrl.hostname === "localhost")) {
    const port = clientHost.split(":")[1] || request.nextUrl.port || "3000";
    return NextResponse.redirect(`http://127.0.0.1:${port}/api/auth/paypal/login`);
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "PAYPAL_CLIENT_ID is not configured on server" },
      { status: 500 }
    );
  }

  let redirectUri: string;
  if (isExplicit127) {
    const port = clientHost.split(":")[1] || request.nextUrl.port || "3000";
    redirectUri = `http://127.0.0.1:${port}/api/auth/paypal/callback`;
  } else if (process.env.APP_URL && !process.env.APP_URL.includes("localhost") && !process.env.APP_URL.includes("127.0.0.1")) {
    redirectUri = `${process.env.APP_URL.replace(/\/$/, "")}/api/auth/paypal/callback`;
  } else {
    const forwardedHost = request.headers.get("x-forwarded-host") || clientHost;
    const protocol = request.headers.get("x-forwarded-proto") || (forwardedHost.includes("localhost") || forwardedHost.includes("127.0.0.1") ? "http" : "https");
    redirectUri = `${protocol}://${forwardedHost}/api/auth/paypal/callback`;
  }

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

