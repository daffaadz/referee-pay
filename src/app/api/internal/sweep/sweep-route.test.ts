import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { env } from "@/config/env";
import * as dbQueries from "@/db/queries";
import * as dbEvents from "@/db/events";
import * as refereeAgent from "@/agent/referee";
import * as executorAgent from "@/agent/executor";

describe("POST /api/internal/sweep", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 Unauthorized if secret header is missing or incorrect", async () => {
    const req = new Request("http://localhost:3000/api/internal/sweep", {
      method: "POST",
      headers: { "x-internal-secret": "wrong-secret" },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Unauthorized");
  });

  it("authenticates and scans active deals with time scaling", async () => {
    vi.spyOn(dbQueries, "getActiveDeals").mockResolvedValue([]);

    const req = new Request("http://localhost:3000/api/internal/sweep", {
      method: "POST",
      headers: { "x-internal-secret": env.INTERNAL_SWEEP_SECRET },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.activeDealsScanned).toBe(0);
    expect(data.actionsTaken).toEqual([]);
  });

  it("processes expired ship deadline on FUNDS_HELD deal and triggers Referee", async () => {
    const pastCreated = new Date(Date.now() - 86400000 * 5); // 5 days ago
    const mockDeal = {
      id: "deal-sweep-1",
      status: "FUNDS_HELD",
      contractJson: {
        item: { title: "Item 1", price: { amount: "50.00", currency: "USD" } },
        seller: { displayName: "Sari", paypalEmail: "sari@example.com" },
        terms: { shipDeadlineDays: 3, deliveryDeadlineDays: 14, inspectionWindowDays: 2 },
        clauses: [{ id: "C2", text: "Ship within 3 days" }],
      },
      amount: "50.00",
      currency: "USD",
      deadlinesJson: {
        shipDeadline: new Date(pastCreated.getTime() + 86400000 * 3).toISOString(),
      },
      createdAt: pastCreated,
    };

    vi.spyOn(dbQueries, "getActiveDeals").mockResolvedValue([mockDeal as any]);
    vi.spyOn(dbEvents, "getEventsForDeal").mockResolvedValue([]);
    vi.spyOn(dbEvents, "appendDealEvent").mockResolvedValue({} as any);

    vi.spyOn(refereeAgent, "runReferee").mockResolvedValue({
      decision: {
        action: "REFUND",
        rationale: "Seller failed to ship within 3 days.",
        clauseRefs: ["C2"],
        evidenceRefs: [],
        confidence: 0.95,
      },
      stepsCount: 1,
      model: "test-model",
      promptVersion: "v1.0.0",
    });

    vi.spyOn(executorAgent, "executeDecision").mockResolvedValue({
      decisionId: "dec-1",
      verdict: "ALLOWED",
      reasons: ["Policy passed"],
      actionExecuted: "REFUND_VOIDED",
      previousStatus: "FUNDS_HELD",
      newStatus: "REFUNDED",
    });

    const req = new Request("http://localhost:3000/api/internal/sweep", {
      method: "POST",
      headers: { "x-internal-secret": env.INTERNAL_SWEEP_SECRET },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.actionsTaken.length).toBe(1);
    expect(data.actionsTaken[0].event).toBe("SHIP_DEADLINE_EXPIRED");
    expect(data.actionsTaken[0].newStatus).toBe("REFUNDED");
  });
});

