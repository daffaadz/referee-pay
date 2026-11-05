import { NextRequest, NextResponse } from "next/server";
import { generateOAuthState, STATE_COOKIE_NAME } from "@/domain/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Inspect the raw HTTP Host header sent by the client.
  // In development, if the request arrived via localhost, redirect once to 127.0.0.1
  // so that the state cookie and the PayPal return URL share the exact same host origin.
  const rawHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  if (rawHost.startsWith("localhost")) {
    const port = rawHost.split(":")[1] || "3000";
    return NextResponse.redirect(`http://127.0.0.1:${port}/api/auth/paypal/login`);
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "PAYPAL_CLIENT_ID is not configured on server" },
      { status: 500 }
    );
  }

  const isLocal = rawHost.includes("127.0.0.1");
  const protocol = request.headers.get("x-forwarded-proto") || (isLocal ? "http" : "https");
  let redirectUri: string;
  if (isLocal) {
    const port = rawHost.split(":")[1] || "3000";
    redirectUri = `http://127.0.0.1:${port}/api/auth/paypal/callback`;
  } else if (process.env.APP_URL && !process.env.APP_URL.includes("localhost") && !process.env.APP_URL.includes("127.0.0.1")) {
    redirectUri = `${process.env.APP_URL.replace(/\/$/, "")}/api/auth/paypal/callback`;
  } else {
    redirectUri = `${protocol}://${rawHost}/api/auth/paypal/callback`;
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

