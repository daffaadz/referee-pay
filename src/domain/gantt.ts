/**
 * Pure domain logic for Bryntum Gantt Deal Room micro-view (FR-15, P1).
 * Generates the 5-task dependency cascade (Pay, Ship, Verify, Review, Release)
 * with planned baseline versus actual schedule, dependencies, and late blocking detection.
 */

import type { DealStatus, DealEventType } from "./state-machine";
import type { DealContract } from "./contract";

export interface GanttTask {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  percentDone: number;
  status: "waiting" | "in_progress" | "late" | "completed" | "refunded";
  statusLabel: string;
  duration: number; // in days
  iconCls?: string;
  cls?: string;
  baselines?: Array<{
    startDate: string;
    endDate: string;
    duration: number;
  }>;
  note?: string;
}

export interface GanttDependency {
  id: number;
  from: number;
  to: number;
  type?: number; // 2 = End-to-Start (standard)
  cls?: string;
}

export interface DealGanttData {
  tasks: GanttTask[];
  dependencies: GanttDependency[];
  projectStartDate: string;
  projectEndDate: string;
}

export function buildDealGanttData({
  dealId,
  status,
  contract,
  createdAt,
  deadlines,
  events = [],
  now = new Date(),
}: {
  dealId: string;
  status: DealStatus;
  contract: DealContract;
  createdAt: Date;
  deadlines?: {
    shipDeadline?: string | null;
    deliveryDeadline?: string | null;
    reviewEnd?: string | null;
  };
  events?: Array<{
    type: DealEventType;
    createdAt: string;
    payload?: Record<string, unknown>;
  }>;
  now?: Date;
}): DealGanttData {
  const dayMs = 24 * 60 * 60 * 1000;
  const terms = contract.terms || {};

  const shipDeadlineDays = Math.max(1, terms.shipDeadlineDays || 3);
  const deliveryDeadlineDays = Math.max(1, terms.deliveryDeadlineDays || 14);
  const inspectionWindowDays = Math.max(1, terms.inspectionWindowDays || 2);

  // Extract event timestamps
  const fundEvent = events.find(
    (e) => e.type === "PAYMENT_AUTHORIZED"
  );
  const shipEvent = events.find((e) => e.type === "SHIPMENT_ADDED");
  const deliveryEvent = events.find(
    (e) => e.type === "DELIVERY_VERIFIED" || e.type === "BUYER_CONFIRMED"
  );
  const releaseEvent = events.find(
    (e) =>
      e.type === "DECISION_RELEASE" ||
      e.type === "DECISION_SETTLE" ||
      e.type === "INSPECTION_PASSED"
  );
  const refundEvent = events.find((e) => e.type === "DECISION_REFUND");

  const fundDate = fundEvent ? new Date(fundEvent.createdAt) : null;
  const shipDate = shipEvent ? new Date(shipEvent.createdAt) : null;
  const deliveryDate = deliveryEvent ? new Date(deliveryEvent.createdAt) : null;
  const releaseDate = releaseEvent ? new Date(releaseEvent.createdAt) : null;

  // Planned baseline timeline (from deal creation)
  const p1Start = new Date(createdAt);
  const p1End = new Date(p1Start.getTime() + 1 * dayMs); // 1 day planned to fund

  const p2Start = new Date(p1End);
  const p2End = new Date(p2Start.getTime() + shipDeadlineDays * dayMs);

  const p3Start = new Date(p2End);
  const p3End = new Date(p3Start.getTime() + deliveryDeadlineDays * dayMs);

  const p4Start = new Date(p3End);
  const p4End = new Date(p4Start.getTime() + inspectionWindowDays * dayMs);

  const p5Start = new Date(p4End);
  const p5End = new Date(p5Start.getTime() + 1 * dayMs); // 1 day planned to release

  // Actual / estimated timeline
  // Task 1: Pay
  const isFunded =
    status !== "DRAFT" && status !== "AWAITING_PAYMENT";
  const t1Start = createdAt;
  const t1End = fundDate || (isFunded ? new Date(createdAt.getTime() + 1 * dayMs) : now);
  const t1Status: GanttTask["status"] = isFunded
    ? "completed"
    : now.getTime() > p1End.getTime()
    ? "late"
    : "in_progress";

  // Task 2: Ship
  const isShipped =
    status === "SHIPPED" ||
    status === "DELIVERED" ||
    status === "RELEASED" ||
    status === "SETTLED";
  const shipDeadline = deadlines?.shipDeadline
    ? new Date(deadlines.shipDeadline)
    : p2End;
  const t2Start = fundDate || p1End;
  const t2End = shipDate || (isShipped ? new Date(t2Start.getTime() + 1 * dayMs) : shipDeadline);
  const t2Late = !isShipped && now.getTime() > shipDeadline.getTime();
  const t2Status: GanttTask["status"] = isShipped
    ? "completed"
    : isFunded
    ? t2Late
      ? "late"
      : "in_progress"
    : "waiting";

  // Task 3: Verify Delivery
  const isDelivered =
    status === "DELIVERED" ||
    status === "RELEASED" ||
    status === "SETTLED";
  const deliveryDeadline = deadlines?.deliveryDeadline
    ? new Date(deadlines.deliveryDeadline)
    : p3End;
  const t3Start = shipDate || t2End;
  const t3End =
    deliveryDate || (isDelivered ? new Date(t3Start.getTime() + 1 * dayMs) : deliveryDeadline);
  const t3Late = !isDelivered && isShipped && now.getTime() > deliveryDeadline.getTime();
  const t3Status: GanttTask["status"] = isDelivered
    ? "completed"
    : isShipped
    ? t3Late
      ? "late"
      : "in_progress"
    : "waiting";

  // Task 4: Buyer Inspection / Review
  const isReviewed = status === "RELEASED" || status === "SETTLED";
  const reviewEnd = deadlines?.reviewEnd
    ? new Date(deadlines.reviewEnd)
    : new Date(t3End.getTime() + inspectionWindowDays * dayMs);
  const t4Start = deliveryDate || t3End;
  const t4End = reviewEnd;
  const t4Late = !isReviewed && isDelivered && now.getTime() > reviewEnd.getTime();
  const t4Status: GanttTask["status"] = isReviewed
    ? "completed"
    : isDelivered
    ? t4Late
      ? "late"
      : "in_progress"
    : "waiting";

  // Task 5: Release / Settlement
  const isReleased = status === "RELEASED" || status === "SETTLED";
  const isRefunded = status === "REFUNDED" || Boolean(refundEvent);
  const t5Start = t4End;
  const t5End =
    releaseDate ||
    (isReleased
      ? new Date(t5Start.getTime() + 1 * dayMs)
      : new Date(t5Start.getTime() + 1 * dayMs));
  const t5Status: GanttTask["status"] = isRefunded
    ? "refunded"
    : isReleased
    ? "completed"
    : isReviewed
    ? "in_progress"
    : "waiting";

  const ensureValidDates = (start: Date, end: Date, fallbackDays = 1) => {
    if (end.getTime() <= start.getTime()) {
      return {
        start,
        end: new Date(start.getTime() + fallbackDays * dayMs),
      };
    }
    return { start, end };
  };

  const v1 = ensureValidDates(t1Start, t1End);
  const v2 = ensureValidDates(t2Start, t2End, shipDeadlineDays);
  const v3 = ensureValidDates(t3Start, t3End, deliveryDeadlineDays);
  const v4 = ensureValidDates(t4Start, t4End, inspectionWindowDays);
  const v5 = ensureValidDates(t5Start, t5End);

  const tasks: GanttTask[] = [
    {
      id: 1,
      name: "1. Deposit & Escrow Hold",
      startDate: v1.start.toISOString(),
      endDate: v1.end.toISOString(),
      percentDone: isFunded ? 100 : 0,
      status: t1Status,
      statusLabel: isFunded ? "Funds Held" : "Awaiting Authorization",
      duration: Math.max(1, Math.round((v1.end.getTime() - v1.start.getTime()) / dayMs)),
      cls: `gantt-task-${t1Status}`,
      baselines: [
        {
          startDate: p1Start.toISOString(),
          endDate: p1End.toISOString(),
          duration: 1,
        },
      ],
      note: "Buyer authorizes escrow hold via PayPal Sandbox.",
    },
    {
      id: 2,
      name: "2. Fulfill & Ship Item",
      startDate: v2.start.toISOString(),
      endDate: v2.end.toISOString(),
      percentDone: isShipped ? 100 : isFunded ? 50 : 0,
      status: t2Status,
      statusLabel: isShipped
        ? "Shipped"
        : t2Late
        ? "Overdue (Blocking)"
        : isFunded
        ? "Ship Pending"
        : "Waiting for Hold",
      duration: Math.max(1, Math.round((v2.end.getTime() - v2.start.getTime()) / dayMs)),
      cls: `gantt-task-${t2Status}`,
      baselines: [
        {
          startDate: p2Start.toISOString(),
          endDate: p2End.toISOString(),
          duration: shipDeadlineDays,
        },
      ],
      note: `Ship within ${shipDeadlineDays} days of funding.`,
    },
    {
      id: 3,
      name: "3. Kernel Web Verification",
      startDate: v3.start.toISOString(),
      endDate: v3.end.toISOString(),
      percentDone: isDelivered ? 100 : isShipped ? 50 : 0,
      status: t3Status,
      statusLabel: isDelivered
        ? "Delivered Verified"
        : t3Late
        ? "Delivery Overdue"
        : isShipped
        ? "In Transit"
        : "Waiting for Shipment",
      duration: Math.max(1, Math.round((v3.end.getTime() - v3.start.getTime()) / dayMs)),
      cls: `gantt-task-${t3Status}`,
      baselines: [
        {
          startDate: p3Start.toISOString(),
          endDate: p3End.toISOString(),
          duration: deliveryDeadlineDays,
        },
      ],
      note: "Kernel browser navigates carrier site to verify delivery.",
    },
    {
      id: 4,
      name: "4. Buyer Inspection Window",
      startDate: v4.start.toISOString(),
      endDate: v4.end.toISOString(),
      percentDone: isReviewed ? 100 : isDelivered ? 50 : 0,
      status: t4Status,
      statusLabel: isReviewed
        ? "Reviewed"
        : t4Late
        ? "Review Expired"
        : isDelivered
        ? "Inspection Open"
        : "Waiting for Delivery",
      duration: Math.max(1, Math.round((v4.end.getTime() - v4.start.getTime()) / dayMs)),
      cls: `gantt-task-${t4Status}`,
      baselines: [
        {
          startDate: p4Start.toISOString(),
          endDate: p4End.toISOString(),
          duration: inspectionWindowDays,
        },
      ],
      note: `${inspectionWindowDays} days window to accept item or open claim.`,
    },
    {
      id: 5,
      name: isRefunded ? "5. Escrow Refund" : "5. Escrow Release",
      startDate: v5.start.toISOString(),
      endDate: v5.end.toISOString(),
      percentDone: isReleased || isRefunded ? 100 : 0,
      status: t5Status,
      statusLabel: isRefunded
        ? "Refunded to Buyer"
        : isReleased
        ? "Released to Seller"
        : "Waiting for Review",
      duration: Math.max(1, Math.round((v5.end.getTime() - v5.start.getTime()) / dayMs)),
      cls: `gantt-task-${t5Status}`,
      baselines: [
        {
          startDate: p5Start.toISOString(),
          endDate: p5End.toISOString(),
          duration: 1,
        },
      ],
      note: "Referee executes payout capture upon verified delivery.",
    },
  ];

  const dependencies: GanttDependency[] = [
    { id: 1, from: 1, to: 2, type: 2 },
    { id: 2, from: 2, to: 3, type: 2 },
    { id: 3, from: 3, to: 4, type: 2 },
    { id: 4, from: 4, to: 5, type: 2 },
  ];

  return {
    tasks,
    dependencies,
    projectStartDate: p1Start.toISOString(),
    projectEndDate: v5.end.toISOString(),
  };
}
