import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDealByToken, updateDealStatus, recordPayment } from "@/db/queries";
import { appendDealEvent } from "@/db/events";
import { fundsHold } from "@/integrations/paypal/funds-hold";
import { transition, DealStatus } from "@/domain/state-machine";

const authorizeBodySchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
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

    if (deal.status !== "AWAITING_PAYMENT") {
      return NextResponse.json(
        { error: `Cannot authorize payment for deal in status '${deal.status}'. Expected 'AWAITING_PAYMENT'.` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = authorizeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { orderId } = parsed.data;

    // Call FundsHold to authorize the PayPal order
    const authResult = await fundsHold.authorizeOrder({
      dealId: deal.id,
      orderId,
    });

    // Verify authorized amount matches contract terms (PE-8 / Money Safety)
    if (
      authResult.amount &&
      (authResult.amount.amount !== deal.amount ||
        authResult.amount.currency !== deal.currency)
    ) {
      return NextResponse.json(
        {
          error: `Amount mismatch: Authorized ${authResult.amount.amount} ${authResult.amount.currency} does not match deal ${deal.amount} ${deal.currency}`,
        },
        { status: 400 }
      );
    }

    // Record authorized payment in payments table
    await recordPayment({
      dealId: deal.id,
      orderId,
      authorizationId: authResult.authorizationId,
      status: authResult.status || "AUTHORIZED",
    });

    // Execute state transition: AWAITING_PAYMENT -> FUNDS_HELD
    const transitionResult = transition(deal.status as DealStatus, {
      dealId: deal.id,
      type: "PAYMENT_AUTHORIZED",
      payload: {
        orderId,
        authorizationId: authResult.authorizationId,
      },
    });

    if (!transitionResult.ok) {
      return NextResponse.json(
        { error: `State transition failed: ${transitionResult.error}` },
        { status: 400 }
      );
    }

    // Persist status change to FUNDS_HELD
    await updateDealStatus(deal.id, transitionResult.newStatus);

    // Append to immutable audit event log
    await appendDealEvent(deal.id, "PAYMENT_AUTHORIZED", {
      orderId,
      authorizationId: authResult.authorizationId,
    });

    return NextResponse.json({
      ok: true,
      dealStatus: transitionResult.newStatus,
      authorizationId: authResult.authorizationId,
    });
  } catch (error: any) {
    console.error("Error authorizing PayPal payment:", error.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to authorize PayPal payment" },
      { status: 500 }
    );
  }
}
