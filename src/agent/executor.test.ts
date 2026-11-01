import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeDecision } from "./executor";
import type { Decision } from "@/domain/decision";
import type { FundsHold } from "@/integrations/paypal/funds-hold";
import * as dbQueries from "@/db/queries";
import * as dbEvents from "@/db/events";

describe("executeDecision", () => {
  const mockDeal = {
    id: "deal-456",
    status: "DELIVERED",
    contractJson: {
      item: {
        title: "Vintage Lens",
        description: "50mm f/1.4",
        price: { amount: "120.00", currency: "USD" },
      },
      seller: { displayName: "Sari", paypalEmail: "sari@example.com" },
      buyer: { displayName: "Maya" },
      terms: {
        shipDeadlineDays: 3,
        deliveryDeadlineDays: 14,
        inspectionWindowDays: 2,
        returnPolicy: { allowed: true, windowDays: 7, returnShippingPaidBy: "buyer" as const },
        autoReleaseAfterInspection: true as const,
      },
      clauses: [
        { id: "C1", text: "Escrow funds held" },
        { id: "C3", text: "Delivery verification" },
      ],
    },
    sellerTokenHash: "seller-hash",
    buyerTokenHash: "buyer-hash",
    amount: "120.00",
    currency: "USD",
    deadlinesJson: {
      deliveryDeadline: new Date(Date.now() + 86400000).toISOString(),
    },
    createdAt: new Date(),
  };

  const mockEvidence = [
    {
      id: "E1",
      dealId: "deal-456",
      kind: "tracking_snapshot" as const,
      source: "mock-carrier",
      contentText: "Package Delivered safely",
      contentHash: "hash-delivered",
      createdAt: new Date(),
    },
  ];

  const mockPayment = {
    id: "pay-1",
    dealId: "deal-456",
    orderId: "ord-123",
    authorizationId: "auth-123",
    status: "AUTHORIZED",
    createdAt: new Date(),
  };

  let mockFundsHold: FundsHold;

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(dbQueries, "getDealById").mockResolvedValue(mockDeal as any);
    vi.spyOn(dbQueries, "getEvidenceForDeal").mockResolvedValue(mockEvidence as any);
    vi.spyOn(dbEvents, "getEventsForDeal").mockResolvedValue([]);
    vi.spyOn(dbQueries, "getPaymentByDealId").mockResolvedValue(mockPayment as any);
    vi.spyOn(dbQueries, "updatePayment").mockResolvedValue();
    vi.spyOn(dbQueries, "updateDealStatus").mockResolvedValue();
    vi.spyOn(dbQueries, "recordDecision").mockResolvedValue();
    vi.spyOn(dbEvents, "appendEvent").mockResolvedValue({} as any);

    mockFundsHold = {
      createOrder: vi.fn(),
      authorizeOrder: vi.fn(),
      release: vi.fn().mockResolvedValue({
        captureId: "cap-999",
        payoutBatchId: "batch-888",
        status: "COMPLETED",
      }),
      refund: vi.fn().mockResolvedValue({
        voidStatus: "VOIDED",
        statusCode: 204,
      }),
    };
  });

  it("executes RELEASE when policy verdict is ALLOWED", async () => {
    const decision: Decision = {
      action: "RELEASE",
      rationale: "Delivery verified via tracking snapshot.",
      clauseRefs: ["C3"],
      evidenceRefs: ["E1"],
      confidence: 0.95,
    };

    const result = await executeDecision({
      dealId: "deal-456",
      trigger: "TRACKING_ADDED",
      decision,
      fundsHold: mockFundsHold,
    });

    expect(result.verdict).toBe("ALLOWED");
    expect(result.actionExecuted).toBe("RELEASE_CAPTURED_AND_PAID");
    expect(result.newStatus).toBe("RELEASED");

    // Proves PayPal was called
    expect(mockFundsHold.release).toHaveBeenCalledWith({
      dealId: "deal-456",
      authorizationId: "auth-123",
      amount: { amount: "120.00", currency: "USD" },
      sellerPaypalEmail: "sari@example.com",
      finalCapture: true,
    });

    // Proves payment updated
    expect(dbQueries.updatePayment).toHaveBeenCalledWith("pay-1", {
      captureId: "cap-999",
      payoutBatchId: "batch-888",
      status: "CAPTURED",
    });

    // Proves decision recorded
    expect(dbQueries.recordDecision).toHaveBeenCalled();
  });

  it("blocks and NEVER calls PayPal when policy engine blocks the decision", async () => {
    const invalidDecision: Decision = {
      action: "RELEASE",
      rationale: "Release money without any valid citations.",
      clauseRefs: [],
      evidenceRefs: [],
      confidence: 0.95,
    };

    const result = await executeDecision({
      dealId: "deal-456",
      trigger: "MANUAL_RERUN",
      decision: invalidDecision,
      fundsHold: mockFundsHold,
    });

    expect(result.verdict).toBe("BLOCKED");
    expect(result.actionExecuted).toBe("BLOCKED");
    expect(result.newStatus).toBe("DELIVERED"); // Unchanged

    // Strictly verifies PayPal was NOT called
    expect(mockFundsHold.release).not.toHaveBeenCalled();
    expect(mockFundsHold.refund).not.toHaveBeenCalled();
    expect(dbQueries.updateDealStatus).not.toHaveBeenCalled();
  });

  it("escalates and NEVER calls PayPal when deal amount exceeds threshold", async () => {
    const highValueDeal = {
      ...mockDeal,
      amount: "500.00",
    };
    vi.spyOn(dbQueries, "getDealById").mockResolvedValue(highValueDeal as any);

    const decision: Decision = {
      action: "RELEASE",
      rationale: "Delivery verified on high value deal.",
      clauseRefs: ["C3"],
      evidenceRefs: ["E1"],
      confidence: 0.95,
    };

    const result = await executeDecision({
      dealId: "deal-456",
      trigger: "TRACKING_ADDED",
      decision,
      fundsHold: mockFundsHold,
      options: { humanApprovalThreshold: 300 },
    });

    expect(result.verdict).toBe("ESCALATED");
    expect(result.actionExecuted).toBe("ESCALATED");
    expect(result.newStatus).toBe("ESCALATED");

    // Strictly verifies PayPal was NOT called
    expect(mockFundsHold.release).not.toHaveBeenCalled();
    expect(mockFundsHold.refund).not.toHaveBeenCalled();
    expect(dbQueries.updateDealStatus).toHaveBeenCalledWith("deal-456", "ESCALATED");
  });

  it("executes PARTIAL_SETTLEMENT (FR-P1-1) with partial capture and releases balance", async () => {
    const claimDeal = {
      ...mockDeal,
      status: "CLAIM_OPEN",
    };
    vi.spyOn(dbQueries, "getDealById").mockResolvedValue(claimDeal as any);

    const decision: Decision = {
      action: "PARTIAL_SETTLEMENT",
      params: { sellerSharePercent: 50 },
      rationale: "Partial damage agreed. 50% settlement approved.",
      clauseRefs: ["C1"],
      evidenceRefs: ["E1"],
      confidence: 0.95,
    };

    const result = await executeDecision({
      dealId: "deal-456",
      trigger: "CLAIM_OPENED",
      decision,
      fundsHold: mockFundsHold,
    });

    expect(result.verdict).toBe("ALLOWED");
    expect(result.actionExecuted).toBe("PARTIAL_SETTLEMENT_50_PERCENT");
    expect(result.newStatus).toBe("SETTLED");
    expect(mockFundsHold.release).toHaveBeenCalledWith({
      dealId: "deal-456",
      authorizationId: "auth-123",
      amount: { amount: "60.00", currency: "USD" },
      sellerPaypalEmail: "sari@example.com",
      finalCapture: true,
    });
    expect(dbQueries.updateDealStatus).toHaveBeenCalledWith("deal-456", "SETTLED");
  });

  it("executes EXTEND_DEADLINE (FR-P1-5) updating deadline without calling PayPal", async () => {
    const inTransitDeal = {
      ...mockDeal,
      status: "SHIPPED",
    };
    vi.spyOn(dbQueries, "getDealById").mockResolvedValue(inTransitDeal as any);
    const updateDeadlinesSpy = vi.spyOn(dbQueries, "updateDealDeadlines").mockResolvedValue();

    const decision: Decision = {
      action: "EXTEND_DEADLINE",
      rationale: "Carrier delay within grace period. Extend deadline by 3 days.",
      clauseRefs: ["C1"],
      evidenceRefs: ["E1"],
      confidence: 0.9,
    };

    const result = await executeDecision({
      dealId: "deal-456",
      trigger: "DEADLINE_TICK",
      decision,
      fundsHold: mockFundsHold,
    });

    expect(result.verdict).toBe("ALLOWED");
    expect(result.actionExecuted).toBe("EXTEND_DEADLINE");
    expect(result.newStatus).toBe("SHIPPED");
    expect(updateDeadlinesSpy).toHaveBeenCalled();
    expect(mockFundsHold.release).not.toHaveBeenCalled();
    expect(mockFundsHold.refund).not.toHaveBeenCalled();
  });
});
