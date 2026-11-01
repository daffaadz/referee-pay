import { NextRequest, NextResponse } from "next/server";
import { getDealByToken, recordPayment } from "@/db/queries";
import { fundsHold } from "@/integrations/paypal/funds-hold";
import type { DealContract } from "@/domain/contract";

export async function POST(
  _request: NextRequest,
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

    if (deal.status !== "AWAITING_PAYMENT") {
      return NextResponse.json(
        { error: `Cannot create order for deal in status '${deal.status}'. Expected 'AWAITING_PAYMENT'.` },
        { status: 400 }
      );
    }

    const contract = deal.contractJson as DealContract;
    const contractPrice = contract.item.price;

    // Call FundsHold to create the order with intent=AUTHORIZE
    const orderResult = await fundsHold.createOrder({
      dealId: deal.id,
      amount: contractPrice,
      customId: deal.id,
    });

    // Persist payment record with order ID
    await recordPayment({
      dealId: deal.id,
      orderId: orderResult.orderId,
      status: "CREATED",
      rawJson: { approveUrl: orderResult.approveUrl },
    });

    return NextResponse.json({
      ok: true,
      orderId: orderResult.orderId,
      approveUrl: orderResult.approveUrl,
    });
  } catch (error: any) {
    console.error("Error creating PayPal order:", error.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to create PayPal order" },
      { status: 500 }
    );
  }
}
