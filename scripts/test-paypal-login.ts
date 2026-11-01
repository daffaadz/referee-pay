import "dotenv/config";
import { GET as loginRoute } from "../src/app/api/auth/paypal/login/route";
import { NextRequest } from "next/server";
import { STATE_COOKIE_NAME } from "../src/domain/session";

async function testLoginRoute() {
  console.log("Testing GET /api/auth/paypal/login...");

  const req = new NextRequest("http://127.0.0.1:3000/api/auth/paypal/login");
  const res = await loginRoute(req);

  console.log("Status:", res.status);
  const location = res.headers.get("location");
  console.log("Redirect Location:", location);

  if (!location) throw new Error("No location header returned");

  const url = new URL(location);
  console.log("Hostname:", url.hostname);
  console.log("Pathname:", url.pathname);
  console.log("client_id:", url.searchParams.get("client_id") ? "Present (redacted)" : "Missing");
  console.log("response_type:", url.searchParams.get("response_type"));
  console.log("scope:", url.searchParams.get("scope"));
  console.log("redirect_uri:", url.searchParams.get("redirect_uri"));
  console.log("state:", url.searchParams.get("state"));

  const stateCookie = res.cookies.get(STATE_COOKIE_NAME);
  console.log("State Cookie Set:", Boolean(stateCookie?.value));
  console.log("State Match:", stateCookie?.value === url.searchParams.get("state"));

  if (
    url.hostname === "www.sandbox.paypal.com" &&
    url.pathname === "/signin/authorize" &&
    url.searchParams.get("response_type") === "code" &&
    url.searchParams.get("scope") === "openid email profile" &&
    stateCookie?.value === url.searchParams.get("state")
  ) {
    console.log("\n[PASS] Real PayPal Sandbox OAuth Login URL is 100% compliant with documentation!");
  } else {
    throw new Error("Verification failed: parameters mismatch");
  }
}

testLoginRoute().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
