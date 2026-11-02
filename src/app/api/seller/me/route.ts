import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/domain/session";
import { getSellerById } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ authenticated: false, seller: null });
  }

  const payload = await verifySessionToken(sessionToken);
  if (!payload) {
    return NextResponse.json({ authenticated: false, seller: null });
  }

  const seller = await getSellerById(payload.sellerId);
  if (!seller) {
    return NextResponse.json({ authenticated: false, seller: null });
  }

  return NextResponse.json({
    authenticated: true,
    seller: {
      id: seller.id,
      email: seller.email,
      name: seller.name,
      emailVerified: seller.emailVerified,
    },
  });
}

