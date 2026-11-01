import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { env } from "@/config/env";
import * as queries from "@/db/queries";
import * as events from "@/db/events";
import * as refereeModule from "@/agent/referee";
import * as executorModule from "@/agent/executor";
import { fundsHold } from "@/integrations/paypal/funds-hold";
import { executeDecision } from "@/agent/executor";
import { evaluatePolicy } from "@/agent/policy-engine";
import { POST as sweepRoute } from "@/app/api/internal/sweep/route";
import { GET as getDealRoute } from "@/app/api/deals/[token]/route";
import { POST as claimRoute } from "@/app/api/deals/[token]/claim/route";
import { POST as authorizeRoute } from "@/app/api/deals/[token]/paypal/authorize/route";
import type { Decision } from "@/domain/decision";

describe("Referee Negative Tests (Idempotency, Edge Cases, Security)", () => {
  // Negative Test 1: Duplicate decision execution (idempotency & PE-7 terminal state guard)
  it("rejects duplicate decision execution when deal is in a terminal state", async () => {
    const terminalDeal = {
      id: "deal-neg-001",
      status: "RELEASED",
      amount: "100.00",
      currency: "USD",
      contractJson: {
        item: { title: "Item", price: { amount: "100.00", currency: "USD" } },
        seller: { displayName: "Seller", paypalEmail: "seller@example.com" },
        clauses: [{ id: "C1", text: "Release" }],
      },
      deadlinesJson: {},
    };

    const decision: Decision = {
      action: "RELEASE",
      rationale: "Duplicate attempt",
      clauseRefs: ["C1"],
      evidenceRefs: [],
      confidence: 0.95,
    };

    const policyResult = evaluatePolicy(
      terminalDeal as any,
      [],
      decision,
      []
    );

    // PE-7 blocks terminal state transitions
    expect(policyResult.verdict).toBe("BLOCKED");
    expect(policyResult.reasons.some((r) => r.includes("terminal"))).toBe(true);

    vi.spyOn(queries, "getDealById").mockResolvedValue(terminalDeal as any);
    vi.spyOn(queries, "getEvidenceForDeal").mockResolvedValue([]);
    vi.spyOn(events, "getEventsForDeal").mockResolvedValue([]);
    vi.spyOn(events, "appendDealEvent").mockResolvedValue({} as any);
    vi.spyOn(events, "appendEvent").mockResolvedValue({} as any);
    vi.spyOn(queries, "recordDecision").mockResolvedValue({} as any);
    vi.spyOn(queries, "getPaymentByDealId").mockResolvedValue({
      authorizationId: "AUTH-001",
      status: "AUTHORIZED",
    } as any);
    const releaseSpy = vi.spyOn(fundsHold, "release");

    const execResult = await executeDecision({
      dealId: terminalDeal.id,
      decision,
      trigger: "TEST_DUPLICATE",
    });
    expect(execResult.verdict).toBe("BLOCKED");
    expect(execResult.actionExecuted).toBe("BLOCKED");
    expect(releaseSpy).not.toHaveBeenCalled();
  });

  // Negative Test 2: Duplicate sweep execution does not duplicate transitions or errors
  it("handles duplicate sweep execution without re-transitioning expired deals", async () => {
    let dealStatus = "FUNDS_HELD";
    const pastShipDeadline = new Date(Date.now() - 86400000).toISOString();

    const mockDeal = {
      id: "deal-neg-002",
      get status() {
        return dealStatus;
      },
      amount: "50.00",
      currency: "USD",
      contractJson: {
        item: { title: "Item", price: { amount: "50.00", currency: "USD" } },
        seller: { displayName: "Seller", paypalEmail: "seller@example.com" },
        clauses: [{ id: "C2", text: "Ship in 3 days" }],
      },
      deadlinesJson: { shipDeadline: pastShipDeadline },
      createdAt: new Date(Date.now() - 86400000 * 4),
    };

    vi.spyOn(queries, "getActiveDeals").mockImplementation(async () => {
      // If deal is still FUNDS_HELD return it, once REFUNDED it is no longer active
      return dealStatus === "FUNDS_HELD" ? [mockDeal as any] : [];
    });
    vi.spyOn(queries, "getDealById").mockImplementation(async () => mockDeal as any);
    vi.spyOn(queries, "getEvidenceForDeal").mockResolvedValue([]);
    vi.spyOn(events, "getEventsForDeal").mockResolvedValue([]);
    vi.spyOn(events, "appendDealEvent").mockResolvedValue({} as any);
    vi.spyOn(events, "appendEvent").mockResolvedValue({} as any);
    vi.spyOn(queries, "recordDecision").mockResolvedValue({} as any);
    vi.spyOn(queries, "getPaymentForDeal").mockResolvedValue({
      authorizationId: "AUTH-002",
      status: "AUTHORIZED",
    } as any);
    vi.spyOn(queries, "getPaymentByDealId").mockResolvedValue({
      authorizationId: "AUTH-002",
      status: "AUTHORIZED",
    } as any);
    vi.spyOn(queries, "updateDealStatus").mockImplementation(async (_id, newStatus) => {
      dealStatus = newStatus;
      return mockDeal as any;
    });
    vi.spyOn(fundsHold, "refund").mockResolvedValue({ voidStatus: "SUCCESS" });

    vi.spyOn(refereeModule, "runReferee").mockResolvedValue({
      decision: {
        action: "REFUND",
        rationale: "Ship deadline expired without tracking",
        clauseRefs: ["C2"],
        evidenceRefs: [],
        confidence: 0.95,
      },
      stepsCount: 1,
      model: "test-model",
      promptVersion: "v1",
    });

    vi.spyOn(executorModule, "executeDecision").mockImplementation(async () => {
      dealStatus = "REFUNDED";
      return {
        decisionId: "dec-1",
        verdict: "ALLOWED",
        reasons: [],
        actionExecuted: "REFUND",
        newStatus: "REFUNDED",
        previousStatus: "FUNDS_HELD",
      };
    });

    // First sweep processes deal
    const req1 = new NextRequest("http://localhost:3000/api/internal/sweep", {
      method: "POST",
      headers: { "x-internal-secret": env.INTERNAL_SWEEP_SECRET },
    });
    const res1 = await sweepRoute(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.activeDealsScanned).toBe(1);

    // Second sweep immediately after: deal is no longer active
    const req2 = new NextRequest("http://localhost:3000/api/internal/sweep", {
      method: "POST",
      headers: { "x-internal-secret": env.INTERNAL_SWEEP_SECRET },
    });
    const res2 = await sweepRoute(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.activeDealsScanned).toBe(0);
  });

  // Negative Test 3: Wrong or invalid token returns 404
  it("returns 404 when querying deal room with non-existent token", async () => {
    vi.spyOn(queries, "getDealByToken").mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/deals/fake-token-12345");
    const res = await getDealRoute(req, {
      params: Promise.resolve({ token: "fake-token-12345" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Deal not found");
  });

  // Negative Test 4: Claim after inspection window expired returns 400
  it("returns 400 when buyer attempts to file claim after inspection window has expired", async () => {
    const expiredInspection = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

    vi.spyOn(queries, "getDealByToken").mockResolvedValue({
      deal: {
        id: "deal-neg-004",
        status: "DELIVERED",
        amount: "80.00",
        currency: "USD",
        contractJson: {
          item: { price: { amount: "80.00", currency: "USD" } },
        },
        deadlinesJson: {
          inspectionDeadline: expiredInspection,
        },
      } as any,
      role: "buyer",
    });

    const req = new NextRequest("http://localhost:3000/api/deals/buyer-token/claim", {
      method: "POST",
      body: JSON.stringify({ reason: "Item has a scratch." }),
    });

    const res = await claimRoute(req, {
      params: Promise.resolve({ token: "buyer-token" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Inspection window has expired");
  });

  // Negative Test 5: Amount mismatch at authorize returns 400
  it("returns 400 when PayPal authorized amount does not match contract amount", async () => {
    vi.spyOn(queries, "getDealByToken").mockResolvedValue({
      deal: {
        id: "deal-neg-005",
        status: "AWAITING_PAYMENT",
        amount: "100.00",
        currency: "USD",
      } as any,
      role: "buyer",
    });

    // PayPal returns authorization for $120.00 instead of $100.00
    vi.spyOn(fundsHold, "authorizeOrder").mockResolvedValue({
      authorizationId: "AUTH-MISMATCH-120",
      status: "CREATED",
      amount: { amount: "120.00", currency: "USD" },
    });

    const req = new NextRequest("http://localhost:3000/api/deals/buyer-token/paypal/authorize", {
      method: "POST",
      body: JSON.stringify({ orderId: "ORDER-TAMPERED" }),
    });

    const res = await authorizeRoute(req, {
      params: Promise.resolve({ token: "buyer-token" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Amount mismatch");
  });
});
