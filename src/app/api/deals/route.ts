import { NextRequest, NextResponse } from "next/server";
import { dealContractSchema, generateDefaultClauses } from "@/domain/contract";
import { generateCapabilityTokens } from "@/domain/tokens";
import { createDeal } from "@/db/queries";
import { appendDealEvent } from "@/db/events";
import { env } from "@/config/env";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/domain/session";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionToken ? await verifySessionToken(sessionToken) : null;

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required: Please sign in with PayPal before creating a deal." },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Auto-generate default clauses if not provided
    if (body.terms && body.item?.price && (!body.clauses || body.clauses.length === 0)) {
      body.clauses = generateDefaultClauses(body.terms, body.item.price);
    }

    const parsed = dealContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid deal contract schema", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const contract = parsed.data;

    // Money safety rule: Force payout destination to verified seller email from session
    contract.seller.paypalEmail = session.email;
    if (session.name && !contract.seller.displayName) {
      contract.seller.displayName = session.name;
    }

    const dealId = `deal_${crypto.randomUUID().slice(0, 12)}`;

    // Generate cryptographic capability tokens (FR-2: >= 128 bits)
    const tokens = generateCapabilityTokens();

    // Persist deal in DB linked to verified seller_id
    const deal = await createDeal({
      id: dealId,
      sellerId: session.sellerId,
      contract,
      sellerTokenHash: tokens.sellerTokenHash,
      buyerTokenHash: tokens.buyerTokenHash,
      deadlines: {
        shipDeadlineDays: contract.terms.shipDeadlineDays,
        deliveryDeadlineDays: contract.terms.deliveryDeadlineDays,
        inspectionWindowDays: contract.terms.inspectionWindowDays,
      },
    });

    // Advance to AWAITING_PAYMENT
    const { updateDealStatus } = await import("@/db/queries");
    await updateDealStatus(dealId, "AWAITING_PAYMENT");

    // Append audit event
    await appendDealEvent(dealId, "CONTRACT_CREATED", {
      itemTitle: contract.item.title,
      price: contract.item.price,
      sellerId: session.sellerId,
      sellerEmail: session.email,
    });

    const baseUrl = env.APP_URL;

    return NextResponse.json({
      ok: true,
      dealId: deal.id,
      sellerToken: tokens.sellerToken,
      buyerToken: tokens.buyerToken,
      sellerUrl: `${baseUrl}/deal/${tokens.sellerToken}`,
      buyerUrl: `${baseUrl}/deal/${tokens.buyerToken}`,
      contract,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Failed to create deal";
    console.error("Error creating deal:", errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

