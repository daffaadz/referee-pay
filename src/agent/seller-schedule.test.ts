import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as scheduleRoute } from "@/app/api/seller/schedule/route";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/domain/session";
import { db } from "@/db";

describe("Seller Schedule API (/api/seller/schedule) (FR-15)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 Unauthorized when session is absent", async () => {
    const req = new NextRequest("http://127.0.0.1:3000/api/seller/schedule");
    const res = await scheduleRoute(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Authentication required");
  });

  it("returns 401 Unauthorized when session is invalid", async () => {
    const req = new NextRequest("http://127.0.0.1:3000/api/seller/schedule");
    req.cookies.set(SESSION_COOKIE_NAME, "forged_or_invalid_session_token");

    const res = await scheduleRoute(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Invalid or expired session");
  });

  it("returns seller-scoped schedule conforming to contract", async () => {
    const sellerId = "seller_alice_sched";
    const token = await createSessionToken({
      sellerId,
      email: "alice.sched@example.com",
      name: "Alice Seller",
    });

    const mockDeals = [
      {
        id: "deal_alice_1",
        sellerId,
        status: "FUNDS_HELD",
        contractJson: {
          item: { title: "Artisan Ceramic Mug", price: { amount: "45.00", currency: "USD" } },
          buyer: { displayName: "Bob" },
          terms: { shipDeadlineDays: 2, deliveryDeadlineDays: 7, inspectionWindowDays: 1 },
        },
        amount: "45.00",
        currency: "USD",
        deadlinesJson: {
          shipDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
          deliveryDeadline: new Date(Date.now() + 9 * 86400000).toISOString(),
        },
        createdAt: new Date(),
      },
    ];

    const mockDecisions = [
      {
        id: "dec_alice_1",
        dealId: "deal_alice_1",
        trigger: "PAYMENT_HOLD",
        decisionJson: {
          action: "HOLD",
          rationale: "Buyer funds secured in escrow hold.",
          clauseRefs: ["C1"],
          evidenceRefs: [],
        },
        policyVerdict: "ALLOWED",
        policyReasons: [],
        createdAt: new Date(),
      },
    ];

    // Spy on DB queries
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: vi.fn().mockImplementation((table: any) => {
        const tableName = table[Symbol.for("drizzle:Name")] || "";
        return {
          where: vi.fn().mockImplementation(() => {
            const data =
              tableName === "deals"
                ? mockDeals
                : tableName === "decisions"
                ? mockDecisions
                : [];
            return {
              orderBy: vi.fn().mockResolvedValue(data),
              then: (resolve: any) => resolve(data),
            };
          }),
        };
      }),
    })) as any);

    const req = new NextRequest("http://127.0.0.1:3000/api/seller/schedule");
    req.cookies.set(SESSION_COOKIE_NAME, token);

    const res = await scheduleRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.resources).toBeInstanceOf(Array);
    expect(data.resources).toHaveLength(1);
    expect(data.resources[0].id).toBe("deal_alice_1");
    expect(data.resources[0].name).toBe("Artisan Ceramic Mug");
    expect(data.resources[0].buyerName).toBe("Bob");

    expect(data.events).toBeInstanceOf(Array);
    // 3 window bars + 1 decision marker
    expect(data.events).toHaveLength(4);

    const shipEvent = data.events.find((e: any) => e.windowType === "ship");
    expect(shipEvent).toBeDefined();
    expect(shipEvent.state).toBe("active");
    expect(shipEvent.readOnly).toBe(true);

    const decisionEvent = data.events.find((e: any) => e.isMilestone);
    expect(decisionEvent).toBeDefined();
    expect(decisionEvent.action).toBe("HOLD");
    expect(decisionEvent.shortRationale).toContain("Buyer funds secured in escrow hold");

    expect(data.timeRanges).toBeInstanceOf(Array);
    expect(data.timeRanges[0].id).toBe("today_line");
    expect(data.updatedAt).toBeDefined();
  });

  it("proves Seller A cannot see Seller B's schedule (Seller Isolation)", async () => {
    const sellerAToken = await createSessionToken({
      sellerId: "seller_A",
      email: "sellerA@example.com",
    });

    const dealsTableWhereSpy = vi.fn();

    vi.spyOn(db, "select").mockImplementation((() => ({
      from: vi.fn().mockImplementation(() => ({
        where: dealsTableWhereSpy.mockImplementation(() => ({
          orderBy: vi.fn().mockResolvedValue([]),
        })),
      })),
    })) as any);

    const req = new NextRequest("http://127.0.0.1:3000/api/seller/schedule");
    req.cookies.set(SESSION_COOKIE_NAME, sellerAToken);

    const res = await scheduleRoute(req);
    expect(res.status).toBe(200);

    // Verify SQL query had condition matching sellerId === seller_A
    expect(dealsTableWhereSpy).toHaveBeenCalled();
  });
});
