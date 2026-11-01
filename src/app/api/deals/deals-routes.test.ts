import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import * as queries from "@/db/queries";
import * as events from "@/db/events";
import * as kernelClient from "@/integrations/kernel/client";
import * as refereeAgent from "@/agent/referee";
import * as executorAgent from "@/agent/executor";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/domain/session";
import { POST as createDealRoute } from "./route";
import { GET as getDealRoute } from "./[token]/route";
import { POST as shipRoute } from "./[token]/ship/route";
import { POST as confirmRoute } from "./[token]/confirm/route";
import { POST as claimRoute } from "./[token]/claim/route";

describe("Deal Lifecycle API Routes (FR-1, FR-4, FR-8)", () => {
  it("POST /api/deals validates contract schema and returns capability links", async () => {
    vi.spyOn(queries, "createDeal").mockResolvedValue({ id: "deal_123" } as any);
    vi.spyOn(queries, "updateDealStatus").mockResolvedValue({} as any);
    vi.spyOn(events, "appendDealEvent").mockResolvedValue({} as any);

    const validPayload = {
      item: {
        title: "Mechanical Keyboard",
        description: "Custom split mechanical keyboard.",
        price: { amount: "150.00", currency: "USD" },
      },
      seller: {
        displayName: "Sari",
        paypalEmail: "sari-seller@example.com",
      },
      terms: {
        shipDeadlineDays: 3,
        deliveryDeadlineDays: 14,
        inspectionWindowDays: 2,
        returnPolicy: { allowed: true, windowDays: 7, returnShippingPaidBy: "buyer" },
        autoReleaseAfterInspection: true,
      },
    };

    const sessionToken = await createSessionToken({
      sellerId: "seller_test_123",
      email: "sari-seller@example.com",
      name: "Sari",
    });

    const req = new NextRequest("http://localhost:3000/api/deals", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });
    req.cookies.set(SESSION_COOKIE_NAME, sessionToken);

    const res = await createDealRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.sellerToken).toBeDefined();
    expect(data.buyerToken).toBeDefined();
    expect(data.sellerUrl).toContain("/deal/");
    expect(data.buyerUrl).toContain("/deal/");
    expect(data.contract.clauses.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/deals/[token] returns deal room state and identifies role", async () => {
    vi.spyOn(queries, "getDealByToken").mockResolvedValue({
      deal: {
        id: "deal_123",
        status: "FUNDS_HELD",
        contractJson: { item: { title: "Test Item", price: { amount: "50.00", currency: "USD" } } },
        amount: "50.00",
        currency: "USD",
        deadlinesJson: {},
        createdAt: new Date(),
      } as any,
      role: "seller",
    });

    vi.spyOn(events, "getDealEvents").mockResolvedValue([
      { id: "e1", dealId: "deal_123", type: "CONTRACT_CREATED", createdAt: new Date() },
    ]);
    vi.spyOn(queries, "getEvidenceForDeal").mockResolvedValue([]);
    vi.spyOn(queries, "getPaymentByDealId").mockResolvedValue(null as any);
    vi.spyOn(queries, "getDecisionsForDeal").mockResolvedValue([]);

    const req = new NextRequest("http://localhost:3000/api/deals/token123");
    const res = await getDealRoute(req, { params: Promise.resolve({ token: "token123" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.role).toBe("seller");
    expect(data.deal.status).toBe("FUNDS_HELD");
    expect(data.events.length).toBe(1);
  });

  it("POST /api/deals/[token]/ship permits only seller in FUNDS_HELD to add tracking", async () => {
    vi.spyOn(queries, "getDealByToken").mockResolvedValue({
      deal: {
        id: "deal_123",
        status: "FUNDS_HELD",
      } as any,
      role: "seller",
    });

    const updateStatusSpy = vi.spyOn(queries, "updateDealStatus").mockResolvedValue({} as any);
    const appendEventSpy = vi.spyOn(events, "appendDealEvent").mockResolvedValue({} as any);
    vi.spyOn(queries, "getEvidenceForDeal").mockResolvedValue([]);
    vi.spyOn(queries, "addEvidence").mockResolvedValue({} as any);
    vi.spyOn(kernelClient, "verifyTrackingWithKernel").mockResolvedValue({
      trackingNumber: "TRK-987",
      carrier: "Mock Carrier",
      status: "In transit",
      statusText: "Status: In transit | Tracking: TRK-987 | Carrier: Mock Carrier",
      contentHash: "hash-mock",
      verifiedAt: new Date(),
    });

    const req = new NextRequest("http://localhost:3000/api/deals/token123/ship", {
      method: "POST",
      body: JSON.stringify({ carrier: "Mock Carrier", trackingNumber: "TRK-987" }),
    });

    const res = await shipRoute(req, { params: Promise.resolve({ token: "token123" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.dealStatus).toBe("SHIPPED");
    expect(updateStatusSpy).toHaveBeenCalledWith("deal_123", "SHIPPED");
    expect(appendEventSpy).toHaveBeenCalledWith("deal_123", "SHIPMENT_ADDED", expect.objectContaining({ trackingNumber: "TRK-987" }));
  });

  it("POST /api/deals/[token]/ship rejects buyer attempts", async () => {
    vi.spyOn(queries, "getDealByToken").mockResolvedValue({
      deal: {
        id: "deal_123",
        status: "FUNDS_HELD",
      } as any,
      role: "buyer",
    });

    const req = new NextRequest("http://localhost:3000/api/deals/token123/ship", {
      method: "POST",
      body: JSON.stringify({ carrier: "Mock Carrier", trackingNumber: "TRK-987" }),
    });

    const res = await shipRoute(req, { params: Promise.resolve({ token: "token123" }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Only the seller");
  });

  it("POST /api/deals/[token]/claim allows buyer in DELIVERED to open dispute", async () => {
    vi.spyOn(queries, "getDealByToken").mockResolvedValue({
      deal: {
        id: "deal_123",
        status: "DELIVERED",
      } as any,
      role: "buyer",
    });

    vi.spyOn(queries, "updateDealStatus").mockResolvedValue({} as any);
    vi.spyOn(queries, "addEvidence").mockResolvedValue({} as any);
    vi.spyOn(events, "appendDealEvent").mockResolvedValue({} as any);
    vi.spyOn(refereeAgent, "runReferee").mockResolvedValue({
      decision: {
        action: "REQUEST_EVIDENCE",
        rationale: "Claim opened, reviewing photos.",
        clauseRefs: [],
        evidenceRefs: [],
        confidence: 0.8,
      },
      stepsCount: 1,
      model: "test-model",
      promptVersion: "v1.0.0",
    });
    vi.spyOn(executorAgent, "executeDecision").mockResolvedValue({
      decisionId: "dec-claim-1",
      verdict: "ALLOWED",
      reasons: ["Claim registered"],
      actionExecuted: "REQUEST_EVIDENCE",
      previousStatus: "CLAIM_OPEN",
      newStatus: "CLAIM_OPEN",
    });

    const req = new NextRequest("http://localhost:3000/api/deals/token123/claim", {
      method: "POST",
      body: JSON.stringify({ reason: "Item damaged during transport" }),
    });

    const res = await claimRoute(req, { params: Promise.resolve({ token: "token123" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.dealStatus).toBe("CLAIM_OPEN");
    expect(data.evidenceId).toBeDefined();
  });

  it("POST /api/deals/[token]/confirm allows buyer to confirm receipt and triggers release", async () => {
    vi.spyOn(queries, "getDealByToken").mockResolvedValue({
      deal: {
        id: "deal_123",
        status: "DELIVERED",
      } as any,
      role: "buyer",
    });

    vi.spyOn(events, "appendDealEvent").mockResolvedValue({} as any);
    vi.spyOn(queries, "addEvidence").mockResolvedValue({} as any);

    vi.spyOn(refereeAgent, "runReferee").mockResolvedValue({
      decision: {
        action: "RELEASE",
        rationale: "Buyer explicitly confirmed receipt.",
        clauseRefs: ["C1"],
        evidenceRefs: [],
        confidence: 0.99,
      },
      stepsCount: 1,
      model: "test-model",
      promptVersion: "v1.0.0",
    });

    vi.spyOn(executorAgent, "executeDecision").mockResolvedValue({
      decisionId: "dec-conf-1",
      verdict: "ALLOWED",
      reasons: ["Buyer confirmed receipt"],
      actionExecuted: "RELEASE_CAPTURED_AND_PAID",
      previousStatus: "DELIVERED",
      newStatus: "RELEASED",
    });

    const req = new NextRequest("http://localhost:3000/api/deals/token123/confirm", {
      method: "POST",
    });

    const res = await confirmRoute(req, { params: Promise.resolve({ token: "token123" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.dealStatus).toBe("RELEASED");
  });
});
