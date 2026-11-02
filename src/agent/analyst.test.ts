import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createAnalystTools, getAnalystToolNames } from "./analyst";
import { POST as analystRoute } from "@/app/api/seller/analyst/route";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/domain/session";
import { db } from "@/db";

// Mock database calls
vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn(),
    },
  };
});

describe("AG Studio Analyst Agent: Referee Analyst (FR-P1-6)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  describe("Security Rule: Zero Money Movement", () => {
    it("exposes strictly read-only and analytical tools to the agent", () => {
      const toolNames = getAnalystToolNames();
      expect(toolNames).toEqual([
        "list_deals",
        "get_ledger_summary",
        "get_deal_risk_details",
        "list_referee_decisions",
        "create_or_filter_widget",
      ]);
    });

    it("verifies that no money-moving or deal-mutating tools exist in the agent toolset", () => {
      const toolNames = getAnalystToolNames();
      const forbiddenOperations = [
        "execute",
        "authorize",
        "capture",
        "payout",
        "refund",
        "void",
        "update",
        "delete",
        "mutate",
        "settle",
        "release",
      ];

      for (const forbidden of forbiddenOperations) {
        const matchingTools = toolNames.filter((t) => t.toLowerCase().includes(forbidden));
        expect(
          matchingTools,
          `Agent should never have money-moving or state-mutating tool matching '${forbidden}'`
        ).toEqual([]);
      }
    });
  });

  describe("Seller Data Isolation", () => {
    it("ensures list_deals only queries and returns deals for the authenticated seller", async () => {
      const sellerAId = "seller_alice_101";
      const { tools } = createAnalystTools(sellerAId);

      const mockDeals = [
        {
          id: "deal_alice_1",
          sellerId: sellerAId,
          amount: "150.00",
          currency: "USD",
          status: "FUNDS_HELD",
          contractJson: {
            item: { title: "Mechanical Keyboard" },
            buyer: { displayName: "Lucas" },
          },
          deadlinesJson: {
            shipDeadlineDays: 3,
            deliveryDeadlineDays: 14,
            trackingHistory: [],
          },
          createdAt: new Date(Date.now() - 2 * 86400000), // 2 days elapsed out of 3 -> high risk
        },
      ];

      // Setup Drizzle mock chain: db.select().from().where().orderBy()
      const mockOrderBy = vi.fn().mockResolvedValue(mockDeals);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      // Execute list_deals tool
      const result = await (tools.list_deals as any).execute({ status: "FUNDS_HELD" });

      expect(mockFrom).toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.deals[0].id).toBe("deal_alice_1");
      expect(result.deals[0].riskLevel).toBe("high");
      expect(result.deals[0].hasTracking).toBe(false);
    });

    it("blocks access when a seller attempts to inspect another seller's deal via get_deal_risk_details", async () => {
      const sellerAId = "seller_alice_101";
      const sellerBDealId = "deal_bob_999";
      const { tools } = createAnalystTools(sellerAId);

      // Empty result because deals.sellerId == sellerAId does not match sellerB's deal
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await (tools.get_deal_risk_details as any).execute({ dealId: sellerBDealId });

      expect(result).toHaveProperty("error");
      expect(result.error).toContain("Deal not found or access denied");
    });

    it("ensures get_ledger_summary returns empty and doesn't query payments if seller has no deals", async () => {
      const sellerAId = "seller_empty_zero";
      const { tools } = createAnalystTools(sellerAId);

      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await (tools.get_ledger_summary as any).execute({ type: "all" });

      expect(result.transactions).toEqual([]);
      expect(result.totalAmountHeld).toBe(0);
    });
  });

  describe("Widget Action Generation", () => {
    it("captures create_or_filter_widget action when requested by the agent", async () => {
      const sellerAId = "seller_alice_101";
      const { tools, getExecutedWidgetAction } = createAnalystTools(sellerAId);

      const actionInput = {
        widgetType: "deals_at_risk" as const,
        title: "High Risk Shipments",
        explanation: "2 deals missing tracking past 50% deadline",
        filter: { minRisk: "high" },
      };

      const result = await (tools.create_or_filter_widget as any).execute(actionInput);

      expect(result.success).toBe(true);
      expect(getExecutedWidgetAction()).toEqual(actionInput);
    });
  });

  describe("POST /api/seller/analyst Route Guardrails", () => {
    it("returns 401 when no session cookie is provided", async () => {
      const req = new NextRequest("http://localhost:3000/api/seller/analyst", {
        method: "POST",
        body: JSON.stringify({ message: "Which deals are at risk?" }),
      });

      const res = await analystRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Authentication required");
    });

    it("returns 400 when message is empty or payload is invalid", async () => {
      const token = await createSessionToken({
        sellerId: "seller_alice_101",
        email: "alice@example.com",
        name: "Alice",
      });

      const req = new NextRequest("http://localhost:3000/api/seller/analyst", {
        method: "POST",
        body: JSON.stringify({ message: "" }),
      });
      req.cookies.set(SESSION_COOKIE_NAME, token);

      const res = await analystRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation failed");
    });
  });
});

