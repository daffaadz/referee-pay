import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDealByToken, getPaymentByDealId } from "@/db/queries";
import { processPaymentAuthorization } from "@/integrations/paypal/authorize-service";

const authorizeBodySchema = z.object({
  orderId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const resolved = await getDealByToken(token);
    if (!resolved) {
      return NextResponse.json({ error: "Deal not found or invalid token" }, { status: 404 });
    }

    const { deal } = resolved;

    let orderId: string | undefined;
    try {
      const body = await request.json();
      const parsed = authorizeBodySchema.safeParse(body);
      if (parsed.success && parsed.data.orderId) {
        orderId = parsed.data.orderId;
      }
    } catch {
      // Body may be empty on automatic redirect callback
    }

    if (!orderId) {
      const payment = await getPaymentByDealId(deal.id);
      if (payment?.orderId) {
        orderId = payment.orderId;
      }
    }

    if (!orderId) {
      return NextResponse.json(
        { error: "No PayPal order found for this deal" },
        { status: 400 }
      );
    }

    const result = await processPaymentAuthorization(deal, orderId);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Failed to authorize PayPal payment" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      dealStatus: result.dealStatus,
      authorizationId: result.authorizationId,
      alreadyProcessed: result.alreadyProcessed || false,
    });
  } catch (error: any) {
    console.error("Error authorizing PayPal payment:", error.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to authorize PayPal payment" },
      { status: 500 }
    );
  }
}
