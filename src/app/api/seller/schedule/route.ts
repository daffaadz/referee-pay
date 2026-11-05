import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/domain/session";
import { db } from "@/db";
import { deals, decisions, dealEvents } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { buildScheduleData, type RawDealInput } from "@/domain/schedule";
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

  // Seed demo seller if applicable
  if (process.env.DEMO_MODE === "true" && session.email.includes("demo")) {
    await seedDemoSellerData(session.sellerId, session.email);
  }

  // Fetch deals scoped strictly to this authenticated seller
  const sellerDeals = await db
    .select()
    .from(deals)
    .where(eq(deals.sellerId, session.sellerId))
    .orderBy(desc(deals.createdAt));

  const dealIds = sellerDeals.map((d) => d.id);

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
          .orderBy(desc(dealEvents.createdAt))
      : [];

  const rawDeals: RawDealInput[] = sellerDeals.map((d) => ({
    id: d.id,
    sellerId: d.sellerId,
    status: d.status as any,
    contractJson: d.contractJson,
    amount: d.amount,
    currency: d.currency,
    deadlinesJson: d.deadlinesJson,
    createdAt: d.createdAt,
  }));

  const scheduleData = buildScheduleData({
    deals: rawDeals,
    events: sellerEvents,
    decisions: sellerDecisions,
    referenceTime: new Date(),
  });

  return NextResponse.json(scheduleData);
}
