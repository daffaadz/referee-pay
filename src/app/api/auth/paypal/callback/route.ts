import { NextRequest, NextResponse } from "next/server";
import { STATE_COOKIE_NAME, SESSION_COOKIE_NAME, SESSION_MAX_AGE, createSessionToken } from "@/domain/session";
import { upsertSeller } from "@/db/queries";

export const dynamic = "force-dynamic";

function buildRedirectUrl(request: NextRequest, path: string): string {
  const rawHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const isLocal = rawHost.includes("127.0.0.1") || rawHost.startsWith("localhost");
  const protocol = request.headers.get("x-forwarded-proto") || (isLocal ? "http" : "https");
  const host = rawHost.startsWith("localhost") ? rawHost.replace("localhost", "127.0.0.1") : rawHost;
  if (host) {
    return `${protocol}://${host}${path}`;
  }
  return new URL(path, request.url).toString();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    const errorDescription = searchParams.get("error_description") || oauthError;
    return NextResponse.redirect(
      buildRedirectUrl(request, `/?auth_error=${encodeURIComponent(errorDescription)}`)
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing required authorization code or state parameter" },
      { status: 400 }
    );
  }

  const storedState = request.cookies.get(STATE_COOKIE_NAME)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.json(
      { error: "Invalid state parameter: state mismatch or cookie expired" },
      { status: 400 }
    );
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "PayPal credentials not configured on server" },
      { status: 500 }
    );
  }

  const isSandbox = (process.env.PAYPAL_ENV || "sandbox").toLowerCase() === "sandbox";
  const tokenEndpoint = isSandbox
    ? "https://api-m.sandbox.paypal.com/v1/identity/openidconnect/tokenservice"
    : "https://api-m.paypal.com/v1/identity/openidconnect/tokenservice";

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[PayPal Auth Callback] Token exchange failed:", errBody);
      return NextResponse.redirect(
        buildRedirectUrl(request, `/?auth_error=${encodeURIComponent("Failed to exchange authorization code")}`)
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.redirect(
        buildRedirectUrl(request, `/?auth_error=${encodeURIComponent("No access token returned by PayPal")}`)
      );
    }

    const userinfoEndpoint = isSandbox
      ? "https://api-m.sandbox.paypal.com/v1/identity/openidconnect/userinfo?schema=openid"
      : "https://api-m.paypal.com/v1/identity/openidconnect/userinfo?schema=openid";

    const userinfoRes = await fetch(userinfoEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!userinfoRes.ok) {
      const errBody = await userinfoRes.text();
      console.error("[PayPal Auth Callback] Userinfo fetch failed:", errBody);
      return NextResponse.redirect(
        buildRedirectUrl(request, `/?auth_error=${encodeURIComponent("Failed to fetch user profile")}`)
      );
    }

    const userinfo = await userinfoRes.json();
    const paypalSub = userinfo.sub || userinfo.user_id;
    const email = userinfo.email;
    const name = userinfo.name || null;
    const emailVerified = userinfo.email_verified !== false;

    if (!paypalSub || !email) {
      return NextResponse.redirect(
        buildRedirectUrl(request, `/?auth_error=${encodeURIComponent("Incomplete profile data from PayPal")}`)
      );
    }

    const seller = await upsertSeller({
      paypalSub,
      email,
      emailVerified,
      name,
    });

    const sessionToken = await createSessionToken({
      sellerId: seller.id,
      email: seller.email,
      name: seller.name,
    });

    const redirectResponse = NextResponse.redirect(buildRedirectUrl(request, "/dashboard"));

    redirectResponse.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    // Clear the one-time state cookie
    redirectResponse.cookies.set(STATE_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return redirectResponse;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unexpected error during login";
    console.error("[PayPal Auth Callback] Exception:", errorMsg);
    return NextResponse.redirect(
      buildRedirectUrl(request, `/?auth_error=${encodeURIComponent("Authentication server error")}`)
    );
  }
}

