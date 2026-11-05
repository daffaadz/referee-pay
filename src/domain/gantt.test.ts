import { describe, it, expect } from "vitest";
import { buildDealGanttData } from "./gantt";
import type { DealContract } from "./contract";

describe("Deal Room Gantt Domain Logic (FR-15, P1)", () => {
  const baseContract: DealContract = {
    item: {
      title: "Rare Vintage Mechanical Watch",
      description: "Authentic mint condition timepiece",
      price: { amount: "450.00", currency: "USD" },
    },
    seller: { paypalEmail: "seller@test.com", displayName: "Test Seller" },
    buyer: { paypalEmail: "buyer@test.com", displayName: "Test Buyer" },
    terms: {
      shipDeadlineDays: 3,
      deliveryDeadlineDays: 14,
      inspectionWindowDays: 2,
      returnPolicy: {
        allowed: false,
        windowDays: 0,
        returnShippingPaidBy: "buyer",
      },
      autoReleaseAfterInspection: true,
    },
    clauses: [{ id: "C1", text: "Item must match description exactly." }],
  };

  const createdAt = new Date("2026-11-01T10:00:00.000Z");

  it("builds 5 cascade tasks and 4 dependencies for a new deal in AWAITING_PAYMENT", () => {
    const gantt = buildDealGanttData({
      dealId: "deal_123",
      status: "AWAITING_PAYMENT",
      contract: baseContract,
      createdAt,
      now: new Date("2026-11-01T12:00:00.000Z"),
    });

    expect(gantt.tasks).toHaveLength(5);
    expect(gantt.dependencies).toHaveLength(4);

    // Dependencies chain 1 -> 2 -> 3 -> 4 -> 5
    expect(gantt.dependencies[0]).toEqual({ id: 1, from: 1, to: 2, type: 2 });
    expect(gantt.dependencies[1]).toEqual({ id: 2, from: 2, to: 3, type: 2 });
    expect(gantt.dependencies[2]).toEqual({ id: 3, from: 3, to: 4, type: 2 });
    expect(gantt.dependencies[3]).toEqual({ id: 4, from: 4, to: 5, type: 2 });

    // Task 1 is in_progress, rest are waiting
    expect(gantt.tasks[0].name).toContain("Deposit");
    expect(gantt.tasks[0].percentDone).toBe(0);
    expect(gantt.tasks[0].status).toBe("in_progress");

    expect(gantt.tasks[1].name).toContain("Ship");
    expect(gantt.tasks[1].status).toBe("waiting");

    // Baselines exist
    expect(gantt.tasks[0].baselines).toBeDefined();
    expect(gantt.tasks[0].baselines?.[0].duration).toBe(1);
    expect(gantt.tasks[1].baselines?.[0].duration).toBe(3);
  });

  it("advances progress and marks completed steps when deal is SHIPPED", () => {
    const gantt = buildDealGanttData({
      dealId: "deal_shipped",
      status: "SHIPPED",
      contract: baseContract,
      createdAt,
      events: [
        { type: "PAYMENT_AUTHORIZED", createdAt: "2026-11-01T11:00:00.000Z" },
        { type: "SHIPMENT_ADDED", createdAt: "2026-11-02T15:00:00.000Z" },
      ],
      now: new Date("2026-11-03T10:00:00.000Z"),
    });

    // Task 1: Pay is completed (100%)
    expect(gantt.tasks[0].status).toBe("completed");
    expect(gantt.tasks[0].percentDone).toBe(100);

    // Task 2: Ship is completed (100%)
    expect(gantt.tasks[1].status).toBe("completed");
    expect(gantt.tasks[1].percentDone).toBe(100);

    // Task 3: Verify is in_progress (50%)
    expect(gantt.tasks[2].status).toBe("in_progress");
    expect(gantt.tasks[2].percentDone).toBe(50);
  });

  it("detects overdue shipping and marks task as late and visibly blocking", () => {
    const overdueTime = new Date("2026-11-07T10:00:00.000Z"); // 6 days later, past 3-day deadline
    const gantt = buildDealGanttData({
      dealId: "deal_overdue_ship",
      status: "FUNDS_HELD",
      contract: baseContract,
      createdAt,
      deadlines: {
        shipDeadline: "2026-11-04T10:00:00.000Z",
      },
      events: [{ type: "PAYMENT_AUTHORIZED", createdAt: "2026-11-01T11:00:00.000Z" }],
      now: overdueTime,
    });

    expect(gantt.tasks[0].status).toBe("completed");
    expect(gantt.tasks[1].status).toBe("late");
    expect(gantt.tasks[1].statusLabel).toContain("Overdue (Blocking)");
    expect(gantt.tasks[2].status).toBe("waiting");
  });

  it("handles RELEASED state with 100% completion across all tasks", () => {
    const gantt = buildDealGanttData({
      dealId: "deal_released",
      status: "RELEASED",
      contract: baseContract,
      createdAt,
      events: [
        { type: "PAYMENT_AUTHORIZED", createdAt: "2026-11-01T11:00:00.000Z" },
        { type: "SHIPMENT_ADDED", createdAt: "2026-11-02T15:00:00.000Z" },
        { type: "DELIVERY_VERIFIED", createdAt: "2026-11-05T09:00:00.000Z" },
        { type: "DECISION_RELEASE", createdAt: "2026-11-07T12:00:00.000Z" },
      ],
      now: new Date("2026-11-08T10:00:00.000Z"),
    });

    for (const t of gantt.tasks) {
      expect(t.status).toBe("completed");
      expect(t.percentDone).toBe(100);
    }
    expect(gantt.tasks[4].name).toContain("Escrow Release");
  });

  it("handles REFUNDED state cleanly", () => {
    const gantt = buildDealGanttData({
      dealId: "deal_refunded",
      status: "REFUNDED",
      contract: baseContract,
      createdAt,
      events: [
        { type: "PAYMENT_AUTHORIZED", createdAt: "2026-11-01T11:00:00.000Z" },
        { type: "DECISION_REFUND", createdAt: "2026-11-05T12:00:00.000Z" },
      ],
      now: new Date("2026-11-06T10:00:00.000Z"),
    });

    expect(gantt.tasks[4].status).toBe("refunded");
    expect(gantt.tasks[4].name).toContain("Escrow Refund");
  });
});
