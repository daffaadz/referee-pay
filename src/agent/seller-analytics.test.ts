import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/domain/session";
import { GET as analyticsRoute } from "@/app/api/seller/analytics/route";
import { sellerAnalyticsResponseSchema } from "@/domain/analytics";
import * as queries from "@/db/queries";
import { db } from "@/db";
import { deals } from "@/db/schema";

describe("Seller Analytics API (/api/seller/analytics)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("returns 401 Unauthorized when session is absent", async () => {
    const req = new NextRequest("http://localhost:3000/api/seller/analytics");
    const res = await analyticsRoute(req);
    expect(res.status).toBe(401);
  });

  it("returns seller-scoped analytics conforming to schema", async () => {
    const sessionToken = await createSessionToken({
      sellerId: "seller_alice_1",
      email: "alice@example.com",
      name: "Alice",
    });

    const sampleDeals = [
      {
        id: "deal_alice_1",
        sellerId: "seller_alice_1",
        status: "FUNDS_HELD",
        contractJson: {
          item: { title: "Artisan Vase", price: { amount: "100.00", currency: "USD" } },
          seller: { displayName: "Alice", paypalEmail: "alice@example.com" },
          buyer: { displayName: "Lucas" },
        },
        sellerTokenHash: "hash_alice_1",
        buyerTokenHash: "hash_buyer_1",
        amount: "100.00",
        currency: "USD",
        deadlinesJson: { shipDeadlineDays: 3 },
        createdAt: new Date(),
      },
    ];

    vi.spyOn(db, "select").mockImplementation(() => {
      const builder: any = {
        from: vi.fn().mockImplementation((table: any) => {
          const fromObj: any = {
            where: vi.fn().mockImplementation(() => {
              const whereObj: any = Promise.resolve(table === deals ? sampleDeals : []);
              whereObj.orderBy = vi.fn().mockResolvedValue(table === deals ? sampleDeals : []);
              return whereObj;
            }),
            orderBy: vi.fn().mockResolvedValue(table === deals ? sampleDeals : []),
          };
          return fromObj;
        }),
      };
      return builder;
    });

    const req = new NextRequest("http://localhost:3000/api/seller/analytics");
    req.cookies.set(SESSION_COOKIE_NAME, sessionToken);

    const res = await analyticsRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    const parsed = sellerAnalyticsResponseSchema.safeParse(data);
    expect(parsed.success).toBe(true);
    expect(data.deals.length).toBe(1);
    expect(data.deals[0].id).toBe("deal_alice_1");
    expect(data.deals[0].title).toBe("Artisan Vase");
    expect(data.kpis.heldAmount).toBe("100.00");
  });
});
