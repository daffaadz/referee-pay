import { NextRequest, NextResponse } from "next/server";
import { getDealByToken, getPaymentByDealId, getEvidenceForDeal, getDecisionsForDeal } from "@/db/queries";
import { getDealEvents } from "@/db/events";

export async function GET(
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

    const { deal, role } = resolved;
    const [events, evidence, payment, decisions] = await Promise.all([
      getDealEvents(deal.id),
      getEvidenceForDeal(deal.id),
      getPaymentByDealId(deal.id),
      getDecisionsForDeal(deal.id),
    ]);

    // Return sanitized public deal room state
    return NextResponse.json({
      ok: true,
      deal: {
        id: deal.id,
        status: deal.status,
        contract: deal.contractJson,
        amount: deal.amount,
        currency: deal.currency,
        deadlines: deal.deadlinesJson,
        createdAt: deal.createdAt,
      },
      role,
      events,
      evidence,
      payment: payment
        ? {
            id: payment.id,
            orderId: payment.orderId,
            authorizationId: payment.authorizationId,
            captureId: payment.captureId,
            status: payment.status,
            createdAt: payment.createdAt,
          }
        : null,
      decisions,
    });
  } catch (error: any) {
    console.error("Error retrieving deal:", error.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve deal" },
      { status: 500 }
    );
  }
}

