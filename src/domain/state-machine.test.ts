import { describe, it, expect } from "vitest";
import {
  transition,
  isTerminalStatus,
  DealStatus,
  DealEventType,
  TERMINAL_STATUSES,
} from "./state-machine";

describe("State Machine - transition()", () => {
  it("identifies terminal states accurately", () => {
    expect(isTerminalStatus("RELEASED")).toBe(true);
    expect(isTerminalStatus("REFUNDED")).toBe(true);
    expect(isTerminalStatus("SETTLED")).toBe(true);
    expect(isTerminalStatus("CANCELLED")).toBe(true);

    expect(isTerminalStatus("DRAFT")).toBe(false);
    expect(isTerminalStatus("AWAITING_PAYMENT")).toBe(false);
    expect(isTerminalStatus("FUNDS_HELD")).toBe(false);
    expect(isTerminalStatus("SHIPPED")).toBe(false);
    expect(isTerminalStatus("DELIVERED")).toBe(false);
    expect(isTerminalStatus("CLAIM_OPEN")).toBe(false);
    expect(isTerminalStatus("ESCALATED")).toBe(false);
  });

  describe("Happy Path transitions", () => {
    it("transitions through the complete happy path: DRAFT -> AWAITING_PAYMENT -> FUNDS_HELD -> SHIPPED -> DELIVERED -> RELEASED", () => {
      const dealId = "deal-1";

      // 1. DRAFT -> AWAITING_PAYMENT
      const r1 = transition("DRAFT", { dealId, type: "CONTRACT_CREATED" });
      expect(r1.ok).toBe(true);
      if (r1.ok) expect(r1.newStatus).toBe("AWAITING_PAYMENT");

      // 2. AWAITING_PAYMENT -> FUNDS_HELD
      const r2 = transition("AWAITING_PAYMENT", { dealId, type: "PAYMENT_AUTHORIZED" });
      expect(r2.ok).toBe(true);
      if (r2.ok) expect(r2.newStatus).toBe("FUNDS_HELD");

      // 3. FUNDS_HELD -> SHIPPED
      const r3 = transition("FUNDS_HELD", { dealId, type: "SHIPMENT_ADDED" });
      expect(r3.ok).toBe(true);
      if (r3.ok) expect(r3.newStatus).toBe("SHIPPED");

      // 4. SHIPPED -> DELIVERED
      const r4 = transition("SHIPPED", { dealId, type: "DELIVERY_VERIFIED" });
      expect(r4.ok).toBe(true);
      if (r4.ok) expect(r4.newStatus).toBe("DELIVERED");

      // 5. DELIVERED -> RELEASED (Auto-release after inspection)
      const r5 = transition("DELIVERED", { dealId, type: "INSPECTION_PASSED" });
      expect(r5.ok).toBe(true);
      if (r5.ok) expect(r5.newStatus).toBe("RELEASED");
    });

    it("allows early buyer confirmation from FUNDS_HELD, SHIPPED, and DELIVERED to RELEASED", () => {
      const dealId = "deal-1";

      const r1 = transition("FUNDS_HELD", { dealId, type: "BUYER_CONFIRMED" });
      expect(r1.ok).toBe(true);
      if (r1.ok) expect(r1.newStatus).toBe("RELEASED");

      const r2 = transition("SHIPPED", { dealId, type: "BUYER_CONFIRMED" });
      expect(r2.ok).toBe(true);
      if (r2.ok) expect(r2.newStatus).toBe("RELEASED");

      const r3 = transition("DELIVERED", { dealId, type: "BUYER_CONFIRMED" });
      expect(r3.ok).toBe(true);
      if (r3.ok) expect(r3.newStatus).toBe("RELEASED");
    });
  });

  describe("Refund & Cancellation Paths", () => {
    const dealId = "deal-2";

    it("cancels deal from DRAFT and AWAITING_PAYMENT", () => {
      const r1 = transition("DRAFT", { dealId, type: "CANCEL" });
      expect(r1.ok).toBe(true);
      if (r1.ok) expect(r1.newStatus).toBe("CANCELLED");

      const r2 = transition("AWAITING_PAYMENT", { dealId, type: "CANCEL" });
      expect(r2.ok).toBe(true);
      if (r2.ok) expect(r2.newStatus).toBe("CANCELLED");
    });

    it("refunds when seller fails to ship within deadline", () => {
      const r = transition("FUNDS_HELD", { dealId, type: "SHIP_DEADLINE_EXPIRED" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.newStatus).toBe("REFUNDED");
    });

    it("refunds when delivery fails or delivery deadline expires", () => {
      const r1 = transition("SHIPPED", { dealId, type: "DELIVERY_FAILED" });
      expect(r1.ok).toBe(true);
      if (r1.ok) expect(r1.newStatus).toBe("REFUNDED");

      const r2 = transition("SHIPPED", { dealId, type: "DELIVERY_DEADLINE_EXPIRED" });
      expect(r2.ok).toBe(true);
      if (r2.ok) expect(r2.newStatus).toBe("REFUNDED");
    });
  });

  describe("Dispute & Claim Paths", () => {
    const dealId = "deal-3";

    it("opens claim from DELIVERED to CLAIM_OPEN", () => {
      const r = transition("DELIVERED", { dealId, type: "CLAIM_OPENED" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.newStatus).toBe("CLAIM_OPEN");
    });

    it("handles all Referee decision outcomes from CLAIM_OPEN", () => {
      const rRelease = transition("CLAIM_OPEN", { dealId, type: "DECISION_RELEASE" });
      expect(rRelease.ok).toBe(true);
      if (rRelease.ok) expect(rRelease.newStatus).toBe("RELEASED");

      const rRefund = transition("CLAIM_OPEN", { dealId, type: "DECISION_REFUND" });
      expect(rRefund.ok).toBe(true);
      if (rRefund.ok) expect(rRefund.newStatus).toBe("REFUNDED");

      const rSettle = transition("CLAIM_OPEN", { dealId, type: "DECISION_SETTLE" });
      expect(rSettle.ok).toBe(true);
      if (rSettle.ok) expect(rSettle.newStatus).toBe("SETTLED");

      const rEscalate = transition("CLAIM_OPEN", { dealId, type: "DECISION_ESCALATE" });
      expect(rEscalate.ok).toBe(true);
      if (rEscalate.ok) expect(rEscalate.newStatus).toBe("ESCALATED");
    });

    it("handles human review decisions from ESCALATED to terminal states", () => {
      const rRelease = transition("ESCALATED", { dealId, type: "DECISION_RELEASE" });
      expect(rRelease.ok).toBe(true);
      if (rRelease.ok) expect(rRelease.newStatus).toBe("RELEASED");

      const rRefund = transition("ESCALATED", { dealId, type: "DECISION_REFUND" });
      expect(rRefund.ok).toBe(true);
      if (rRefund.ok) expect(rRefund.newStatus).toBe("REFUNDED");

      const rSettle = transition("ESCALATED", { dealId, type: "DECISION_SETTLE" });
      expect(rSettle.ok).toBe(true);
      if (rSettle.ok) expect(rSettle.newStatus).toBe("SETTLED");
    });
  });

  describe("Audit & Non-advancing events", () => {
    it("allows DEADLINE_EXTENDED on SHIPPED and preserves state", () => {
      const r = transition("SHIPPED", { dealId: "d1", type: "DEADLINE_EXTENDED" });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.previousStatus).toBe("SHIPPED");
        expect(r.newStatus).toBe("SHIPPED");
      }
    });

    it("allows EVIDENCE_ADDED and MESSAGE_SENT on any active state without altering state", () => {
      const activeStates: DealStatus[] = [
        "DRAFT",
        "AWAITING_PAYMENT",
        "FUNDS_HELD",
        "SHIPPED",
        "DELIVERED",
        "CLAIM_OPEN",
        "ESCALATED",
      ];

      for (const st of activeStates) {
        const r1 = transition(st, { dealId: "d1", type: "EVIDENCE_ADDED" });
        expect(r1.ok).toBe(true);
        if (r1.ok) expect(r1.newStatus).toBe(st);

        const r2 = transition(st, { dealId: "d1", type: "MESSAGE_SENT" });
        expect(r2.ok).toBe(true);
        if (r2.ok) expect(r2.newStatus).toBe(st);
      }
    });
  });

  describe("Illegal Transition Guards (PE-7)", () => {
    it("strictly blocks transitions from terminal states", () => {
      const events: DealEventType[] = [
        "CONTRACT_CREATED",
        "PAYMENT_AUTHORIZED",
        "SHIPMENT_ADDED",
        "DELIVERY_VERIFIED",
        "BUYER_CONFIRMED",
        "CANCEL",
        "CLAIM_OPENED",
        "DECISION_RELEASE",
        "DECISION_REFUND",
      ];

      for (const terminal of TERMINAL_STATUSES) {
        for (const evt of events) {
          const result = transition(terminal, { dealId: "d-term", type: evt });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error).toMatch(/terminal state/);
          }
        }
      }
    });

    it("strictly blocks invalid sequence transitions", () => {
      // Cannot ship before funding
      const r1 = transition("AWAITING_PAYMENT", { dealId: "d1", type: "SHIPMENT_ADDED" });
      expect(r1.ok).toBe(false);

      // Cannot confirm delivery before shipping
      const r2 = transition("FUNDS_HELD", { dealId: "d1", type: "DELIVERY_VERIFIED" });
      expect(r2.ok).toBe(false);

      // Cannot open claim in AWAITING_PAYMENT or FUNDS_HELD
      const r3 = transition("FUNDS_HELD", { dealId: "d1", type: "CLAIM_OPENED" });
      expect(r3.ok).toBe(false);

      // Cannot authorize payment when already in FUNDS_HELD
      const r4 = transition("FUNDS_HELD", { dealId: "d1", type: "PAYMENT_AUTHORIZED" });
      expect(r4.ok).toBe(false);
    });
  });
});

