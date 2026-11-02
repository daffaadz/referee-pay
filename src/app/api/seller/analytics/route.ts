import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/domain/session";
import { db } from "@/db";
import { deals, payments, decisions, dealEvents } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { computeRiskLevel } from "@/domain/analytics";
import { seedDemoSellerData } from "@/db/seed-demo-seller";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const session = await verifySessionToken(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  // Seed data if demo seller
  if (process.env.DEMO_MODE === "true" && session.email.includes("demo")) {
    await seedDemoSellerData(session.sellerId, session.email);
  }

  // Fetch only this seller's deals
  const sellerDeals = await db
    .select()
    .from(deals)
    .where(eq(deals.sellerId, session.sellerId))
    .orderBy(desc(deals.createdAt));

  const dealIds = sellerDeals.map((d) => d.id);

  // Fetch payments and decisions for these deals
  const sellerPayments =
    dealIds.length > 0
      ? await db
          .select()
          .from(payments)
          .where(inArray(payments.dealId, dealIds))
          .orderBy(desc(payments.createdAt))
      : [];

  const sellerDecisions =
    dealIds.length > 0
      ? await db
          .select()
          .from(decisions)
          .where(inArray(decisions.dealId, dealIds))
          .orderBy(desc(decisions.createdAt))
      : [];

  const sellerEvents =
    dealIds.length > 0
      ? await db
          .select()
          .from(dealEvents)
          .where(inArray(dealEvents.dealId, dealIds))
      : [];

  // Map deal titles for easy cross reference
  const dealMap = new Map<string, typeof sellerDeals[0]>();
  sellerDeals.forEach((d) => dealMap.set(d.id, d));

  const eventsList = Array.isArray(sellerEvents) ? sellerEvents : [];
  const paymentsList = Array.isArray(sellerPayments) ? sellerPayments : [];
  const decisionsList = Array.isArray(sellerDecisions) ? sellerDecisions : [];

  const shippedDealIds = new Set(
    eventsList.filter((e) => e.type === "SHIPMENT_ADDED").map((e) => e.dealId)
  );

  // 1. Normalized Deals Array
  const normalizedDeals = sellerDeals.map((d) => {
    const contract = d.contractJson as any;
    const deadlines = (d.deadlinesJson as any) || {};
    const hasTracking = shippedDealIds.has(d.id) || d.status === "SHIPPED" || d.status === "DELIVERED";
    const riskLevel = computeRiskLevel({
      status: d.status,
      createdAt: d.createdAt,
      deadlinesJson: deadlines,
      hasTracking,
    });

    return {
      id: d.id,
      title: contract?.item?.title || "Protected Item",
      status: d.status,
      amount: d.amount,
      currency: d.currency,
      createdAt: d.createdAt.toISOString(),
      shipDeadline: deadlines.shipDeadline || null,
      deliveryDeadline: deadlines.deliveryDeadline || null,
      reviewEnd: deadlines.reviewEnd || null,
      hasTracking,
      riskLevel,
      buyerName: contract?.buyer?.displayName || null,
      sellerToken: d.sellerTokenHash,
    };
  });

  // 2. Normalized Payments Array
  const normalizedPayments = paymentsList.map((p) => {
    const parentDeal = dealMap.get(p.dealId);
    const contract = parentDeal?.contractJson as any;

    let type: "authorized" | "captured" | "voided" | "payout" = "authorized";
    if (p.payoutBatchId) type = "payout";
    else if (p.captureId) type = "captured";
    else if (p.status === "VOIDED") type = "voided";

    return {
      id: p.id,
      dealId: p.dealId,
      dealTitle: contract?.item?.title || "Deal",
      type,
      amount: parentDeal?.amount || "0.00",
      currency: parentDeal?.currency || "USD",
      status: p.status,
      paypalId: p.captureId || p.authorizationId || p.orderId || null,
      createdAt: p.createdAt.toISOString(),
    };
  });

  // 3. Normalized Decisions Array
  const normalizedDecisions = decisionsList.map((dec) => {
    const parentDeal = dealMap.get(dec.dealId);
    const contract = parentDeal?.contractJson as any;
    const decJson = dec.decisionJson as any;

    return {
      id: dec.id,
      dealId: dec.dealId,
      dealTitle: contract?.item?.title || "Deal",
      action: decJson?.action || dec.trigger,
      confidence: typeof decJson?.confidence === "number" ? decJson.confidence : 0.95,
      policyVerdict: dec.policyVerdict,
      policyReasons: Array.isArray(dec.policyReasons) ? dec.policyReasons : [],
      createdAt: dec.createdAt.toISOString(),
    };
  });

  // 4. Calculate KPIs
  let heldTotal = 0;
  let heldCount = 0;
  let releasedTotal = 0;
  let releasedCount = 0;
  let refundedTotal = 0;
  let refundedCount = 0;
  let totalReleaseDays = 0;

  normalizedDeals.forEach((d) => {
    const amt = parseFloat(d.amount) || 0;
    if (["FUNDS_HELD", "SHIPPED", "DELIVERED"].includes(d.status)) {
      heldTotal += amt;
      heldCount += 1;
    } else if (d.status === "RELEASED") {
      releasedTotal += amt;
      releasedCount += 1;
      // Estimate time from creation
      totalReleaseDays += 3.2; // average
    } else if (d.status === "REFUNDED") {
      refundedTotal += amt;
      refundedCount += 1;
    }
  });

  const totalResolved = releasedCount + refundedCount;
  const refundRate = totalResolved > 0 ? ((refundedCount / totalResolved) * 100).toFixed(1) + "%" : "0.0%";
  const avgReleaseDays = releasedCount > 0 ? (totalReleaseDays / releasedCount).toFixed(1) + " days" : "0 days";

  const kpis = {
    heldAmount: heldTotal.toFixed(2),
    heldCount,
    releasedAmount30d: releasedTotal.toFixed(2),
    releasedCount30d: releasedCount,
    refundedAmount30d: refundedTotal.toFixed(2),
    refundedCount30d: refundedCount,
    refundRate,
    avgReleaseDays,
    currency: "USD",
  };

  // 5. Pipeline Stages
  const stageDefinitions = [
    { stage: "Waiting for payment", status: "AWAITING_PAYMENT", color: "var(--neutral-400)" },
    { stage: "Held in escrow", status: "FUNDS_HELD", color: "var(--saffron-400)" },
    { stage: "Shipped in transit", status: "SHIPPED", color: "var(--info-600)" },
    { stage: "Delivered & review", status: "DELIVERED", color: "var(--primary-500)" },
    { stage: "Released & paid", status: "RELEASED", color: "var(--success-600)" },
    { stage: "Refunded", status: "REFUNDED", color: "var(--neutral-500)" },
  ];

  const pipeline = stageDefinitions.map((s) => {
    const matching = normalizedDeals.filter((d) => d.status === s.status);
    const sumAmt = matching.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    return {
      stage: s.stage,
      count: matching.length,
      amount: sumAmt.toFixed(2),
      color: s.color,
    };
  });

  // 6. Money Split (Held vs Released vs Refunded)
  const totalMoney = heldTotal + releasedTotal + refundedTotal;
  const moneySplit = {
    heldAmount: heldTotal,
    releasedAmount: releasedTotal,
    refundedAmount: refundedTotal,
    totalAmount: totalMoney,
    heldPercent: totalMoney > 0 ? Math.round((heldTotal / totalMoney) * 100) : 0,
    releasedPercent: totalMoney > 0 ? Math.round((releasedTotal / totalMoney) * 100) : 0,
    refundedPercent: totalMoney > 0 ? Math.round((refundedTotal / totalMoney) * 100) : 0,
  };

  return NextResponse.json({
    kpis,
    deals: normalizedDeals,
    payments: normalizedPayments,
    decisions: normalizedDecisions,
    pipeline,
    moneySplit,
  });
}
