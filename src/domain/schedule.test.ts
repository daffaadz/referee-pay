import { describe, it, expect } from "vitest";
import { computeWindowState, buildScheduleData } from "./schedule";
import type { DealStatus } from "./state-machine";

describe("Bryntum Scheduler Domain Logic (FR-15)", () => {
  const now = new Date("2026-11-06T12:00:00.000Z");

  describe("computeWindowState", () => {
    it("returns 'active' for ship window when deal is in FUNDS_HELD and deadline is in future", () => {
      const state = computeWindowState({
        windowType: "ship",
        status: "FUNDS_HELD",
        deadline: new Date("2026-11-08T12:00:00.000Z"),
        hasTracking: false,
        now,
      });
      expect(state).toBe("active");
    });

    it("returns 'overdue' for ship window when deal is in FUNDS_HELD and deadline has passed", () => {
      const state = computeWindowState({
        windowType: "ship",
        status: "FUNDS_HELD",
        deadline: new Date("2026-11-05T12:00:00.000Z"),
        hasTracking: false,
        now,
      });
      expect(state).toBe("overdue");
    });

    it("returns 'done' for ship window once tracking is added or status is SHIPPED", () => {
      const state = computeWindowState({
        windowType: "ship",
        status: "SHIPPED",
        deadline: new Date("2026-11-08T12:00:00.000Z"),
        hasTracking: true,
        now,
      });
      expect(state).toBe("done");
    });

    it("returns 'active' for delivery window when deal is SHIPPED and deadline is in future", () => {
      const state = computeWindowState({
        windowType: "delivery",
        status: "SHIPPED",
        deadline: new Date("2026-11-15T12:00:00.000Z"),
        hasTracking: true,
        now,
      });
      expect(state).toBe("active");
    });

    it("returns 'overdue' for delivery window when deal is SHIPPED and deadline has passed", () => {
      const state = computeWindowState({
        windowType: "delivery",
        status: "SHIPPED",
        deadline: new Date("2026-11-05T12:00:00.000Z"),
        hasTracking: true,
        now,
      });
      expect(state).toBe("overdue");
    });

    it("returns 'done' for delivery window once DELIVERED", () => {
      const state = computeWindowState({
        windowType: "delivery",
        status: "DELIVERED",
        deadline: new Date("2026-11-05T12:00:00.000Z"),
        hasTracking: true,
        now,
      });
      expect(state).toBe("done");
    });

    it("returns 'refunded' for any window if deal status is REFUNDED", () => {
      const state = computeWindowState({
        windowType: "delivery",
        status: "REFUNDED",
        deadline: new Date("2026-11-05T12:00:00.000Z"),
        hasTracking: true,
        now,
      });
      expect(state).toBe("refunded");
    });
  });

  describe("buildScheduleData", () => {
    it("transforms seller deals and decisions into Bryntum resources, window events, and decision markers", () => {
      const mockDeals = [
        {
          id: "deal_1",
          sellerId: "seller_1",
          status: "SHIPPED" as DealStatus,
          contractJson: {
            item: { title: "Vintage Camera Lens", price: { amount: "280.00", currency: "USD" } },
            buyer: { displayName: "Lucas" },
            terms: { shipDeadlineDays: 3, deliveryDeadlineDays: 14, inspectionWindowDays: 2 },
          },
          amount: "280.00",
          currency: "USD",
          deadlinesJson: {
            shipDeadline: "2026-11-05T00:00:00.000Z",
            deliveryDeadline: "2026-11-19T00:00:00.000Z",
          },
          createdAt: new Date("2026-11-02T00:00:00.000Z"),
        },
      ];

      const mockEvents = [
        {
          id: "ev_1",
          dealId: "deal_1",
          type: "SHIPMENT_ADDED",
          payloadJson: { carrier: "Mock Carrier", trackingNumber: "TRK-123" },
          createdAt: new Date("2026-11-03T10:00:00.000Z"),
        },
      ];

      const mockDecisions = [
        {
          id: "dec_1",
          dealId: "deal_1",
          trigger: "CARRIER_UPDATE",
          decisionJson: {
            action: "EXTEND",
            rationale: "Carrier experiencing severe weather delay. Extended delivery window by 2 days.",
            clauseRefs: ["C2"],
            evidenceRefs: ["E1"],
          },
          policyVerdict: "ALLOWED",
          policyReasons: [],
          createdAt: new Date("2026-11-04T15:00:00.000Z"),
        },
      ];

      const schedule = buildScheduleData({
        deals: mockDeals,
        events: mockEvents,
        decisions: mockDecisions,
        referenceTime: now,
      });

      // 1. Resources: 1 per deal
      expect(schedule.resources).toHaveLength(1);
      expect(schedule.resources[0].id).toBe("deal_1");
      expect(schedule.resources[0].name).toBe("Vintage Camera Lens");
      expect(schedule.resources[0].buyerName).toBe("Lucas");
      expect(schedule.resources[0].amount).toBe("$280.00 USD");
      expect(schedule.resources[0].status).toBe("SHIPPED");

      // 2. Events: 3 window bars + 1 decision marker
      expect(schedule.events).toHaveLength(4);

      const shipBar = schedule.events.find((e) => e.windowType === "ship");
      expect(shipBar).toBeDefined();
      expect(shipBar?.state).toBe("done");
      expect(shipBar?.readOnly).toBe(true);

      const deliveryBar = schedule.events.find((e) => e.windowType === "delivery");
      expect(deliveryBar).toBeDefined();
      expect(deliveryBar?.state).toBe("active");

      const decisionMarker = schedule.events.find((e) => e.isMilestone);
      expect(decisionMarker).toBeDefined();
      expect(decisionMarker?.name).toContain("Referee Decision: EXTEND");
      expect(decisionMarker?.shortRationale).toContain("severe weather delay");
      expect(decisionMarker?.clauseRefs).toEqual(["C2"]);
      expect(decisionMarker?.evidenceRefs).toEqual(["E1"]);

      // 3. TimeRanges: Today line
      expect(schedule.timeRanges.length).toBeGreaterThanOrEqual(1);
      expect(schedule.timeRanges[0].id).toBe("today_line");
    });
  });
});

