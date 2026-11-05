import type { DealStatus } from "./state-machine";

export type WindowType = "ship" | "delivery" | "review";
export type WindowState = "upcoming" | "active" | "overdue" | "done" | "refunded";

export interface ScheduleResource {
  id: string; // deal.id
  name: string; // item title
  buyerName: string;
  amount: string; // formatted e.g. "$280.00 USD"
  status: DealStatus;
  statusLabel: string;
  dealId: string;
  createdAt: string;
}

export interface ScheduleEvent {
  id: string;
  resourceId: string;
  name: string;
  startDate: string;
  endDate: string;
  windowType?: WindowType;
  state: WindowState;
  icon: string;
  readOnly: boolean;
  isMilestone?: boolean;
  action?: string;
  shortRationale?: string;
  clauseRefs?: string[];
  evidenceRefs?: string[];
  dealId: string;
}

export interface ScheduleTimeRange {
  id: string;
  name: string;
  startDate: string;
  cls?: string;
}

export interface ScheduleData {
  resources: ScheduleResource[];
  events: ScheduleEvent[];
  timeRanges: ScheduleTimeRange[];
  updatedAt: string;
}

export function formatStatusLabel(status: DealStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "AWAITING_PAYMENT":
      return "Waiting for payment";
    case "FUNDS_HELD":
      return "Funds held";
    case "SHIPPED":
      return "Shipped";
    case "DELIVERED":
      return "Delivered";
    case "RELEASED":
      return "Released";
    case "REFUNDED":
      return "Refunded";
    case "SETTLED":
      return "Settled";
    case "CLAIM_OPEN":
      return "Claim open";
    case "ESCALATED":
      return "Escalated";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function computeWindowState({
  windowType,
  status,
  deadline,
  hasTracking,
  now = new Date(),
}: {
  windowType: WindowType;
  status: DealStatus;
  deadline?: Date | null;
  hasTracking?: boolean;
  now?: Date;
}): WindowState {
  if (status === "REFUNDED" || status === "CANCELLED") {
    return "refunded";
  }

  const deadlinePassed = deadline ? now.getTime() > deadline.getTime() : false;

  switch (windowType) {
    case "ship": {
      if (hasTracking || status === "SHIPPED" || status === "DELIVERED" || status === "RELEASED" || status === "SETTLED") {
        return "done";
      }
      if (status === "FUNDS_HELD") {
        return deadlinePassed ? "overdue" : "active";
      }
      return "upcoming";
    }

    case "delivery": {
      if (status === "DELIVERED" || status === "RELEASED" || status === "SETTLED") {
        return "done";
      }
      if (status === "SHIPPED") {
        return deadlinePassed ? "overdue" : "active";
      }
      return "upcoming";
    }

    case "review": {
      if (status === "RELEASED" || status === "SETTLED") {
        return "done";
      }
      if (status === "DELIVERED") {
        return deadlinePassed ? "overdue" : "active";
      }
      return "upcoming";
    }

    default:
      return "upcoming";
  }
}

export interface RawDealInput {
  id: string;
  sellerId: string | null;
  status: DealStatus;
  contractJson: unknown;
  amount: string;
  currency: string;
  deadlinesJson: unknown;
  createdAt: Date;
}

export interface RawEventInput {
  id: string;
  dealId: string;
  type: string;
  payloadJson: unknown;
  createdAt: Date;
}

export interface RawDecisionInput {
  id: string;
  dealId: string;
  trigger: string;
  decisionJson: unknown;
  policyVerdict: string;
  policyReasons: unknown;
  createdAt: Date;
}

export function buildScheduleData({
  deals,
  events = [],
  decisions = [],
  referenceTime = new Date(),
}: {
  deals: RawDealInput[];
  events?: RawEventInput[];
  decisions?: RawDecisionInput[];
  referenceTime?: Date;
}): ScheduleData {
  const safeDeals = Array.isArray(deals) ? deals : [];
  const safeEvents = Array.isArray(events) ? events : [];
  const safeDecisions = Array.isArray(decisions) ? decisions : [];

  const dayMs = 86400000;
  const shippedDealIds = new Set(
    safeEvents.filter((e) => e.type === "SHIPMENT_ADDED").map((e) => e.dealId)
  );

  // Map shipment event times per deal
  const shipmentAddedTimes = new Map<string, Date>();
  for (const e of safeEvents) {
    if (e.type === "SHIPMENT_ADDED" && !shipmentAddedTimes.has(e.dealId)) {
      shipmentAddedTimes.set(e.dealId, e.createdAt);
    }
  }

  // Map delivery confirmed times per deal
  const deliveryConfirmedTimes = new Map<string, Date>();
  for (const e of safeEvents) {
    if (e.type === "DELIVERY_CONFIRMED" && !deliveryConfirmedTimes.has(e.dealId)) {
      deliveryConfirmedTimes.set(e.dealId, e.createdAt);
    }
  }

  const resources: ScheduleResource[] = [];
  const scheduleEvents: ScheduleEvent[] = [];

  for (const deal of safeDeals) {
    const contract = (deal.contractJson as Record<string, any>) || {};
    const item = contract.item || {};
    const buyer = contract.buyer || {};
    const terms = contract.terms || {};
    const deadlines = (deal.deadlinesJson as Record<string, any>) || {};

    const title = item.title || "Protected Item";
    const buyerName = buyer.displayName || "Buyer";
    const formattedAmount = `$${deal.amount} ${deal.currency}`;

    resources.push({
      id: deal.id,
      name: title,
      buyerName,
      amount: formattedAmount,
      status: deal.status,
      statusLabel: formatStatusLabel(deal.status),
      dealId: deal.id,
      createdAt: deal.createdAt.toISOString(),
    });

    // 1. Ship Window
    const shipDeadlineDays = terms.shipDeadlineDays || 3;
    const shipStartDate = deal.createdAt;
    const rawShipEndDate = deadlines.shipDeadline
      ? new Date(deadlines.shipDeadline)
      : new Date(shipStartDate.getTime() + shipDeadlineDays * dayMs);
    const shipEndDate = rawShipEndDate.getTime() <= shipStartDate.getTime()
      ? new Date(shipStartDate.getTime() + Math.max(1, shipDeadlineDays) * dayMs)
      : rawShipEndDate;

    const hasTracking = shippedDealIds.has(deal.id);
    const shipState = computeWindowState({
      windowType: "ship",
      status: deal.status,
      deadline: shipEndDate,
      hasTracking,
      now: referenceTime,
    });

    scheduleEvents.push({
      id: `${deal.id}_ship`,
      resourceId: deal.id,
      name: "Ship window",
      startDate: shipStartDate.toISOString(),
      endDate: shipEndDate.toISOString(),
      windowType: "ship",
      state: shipState,
      icon: "ph-package",
      readOnly: true,
      dealId: deal.id,
    });

    // 2. Delivery Window
    const deliveryDeadlineDays = terms.deliveryDeadlineDays || 14;
    const deliveryStartDate = shipmentAddedTimes.get(deal.id) || shipEndDate;
    const rawDeliveryEndDate = deadlines.deliveryDeadline
      ? new Date(deadlines.deliveryDeadline)
      : new Date(deliveryStartDate.getTime() + deliveryDeadlineDays * dayMs);
    const deliveryEndDate = rawDeliveryEndDate.getTime() <= deliveryStartDate.getTime()
      ? new Date(deliveryStartDate.getTime() + Math.max(1, deliveryDeadlineDays) * dayMs)
      : rawDeliveryEndDate;

    const deliveryState = computeWindowState({
      windowType: "delivery",
      status: deal.status,
      deadline: deliveryEndDate,
      hasTracking,
      now: referenceTime,
    });

    scheduleEvents.push({
      id: `${deal.id}_delivery`,
      resourceId: deal.id,
      name: "Delivery window",
      startDate: deliveryStartDate.toISOString(),
      endDate: deliveryEndDate.toISOString(),
      windowType: "delivery",
      state: deliveryState,
      icon: "ph-truck",
      readOnly: true,
      dealId: deal.id,
    });

    // 3. Review Window
    const inspectionWindowDays = terms.inspectionWindowDays || 2;
    const reviewStartDate = deliveryConfirmedTimes.get(deal.id) || deliveryEndDate;
    const rawReviewEndDate = deadlines.reviewEnd
      ? new Date(deadlines.reviewEnd)
      : new Date(reviewStartDate.getTime() + inspectionWindowDays * dayMs);
    const reviewEndDate = rawReviewEndDate.getTime() <= reviewStartDate.getTime()
      ? new Date(reviewStartDate.getTime() + Math.max(1, inspectionWindowDays) * dayMs)
      : rawReviewEndDate;

    const reviewState = computeWindowState({
      windowType: "review",
      status: deal.status,
      deadline: reviewEndDate,
      hasTracking,
      now: referenceTime,
    });

    scheduleEvents.push({
      id: `${deal.id}_review`,
      resourceId: deal.id,
      name: "Review window",
      startDate: reviewStartDate.toISOString(),
      endDate: reviewEndDate.toISOString(),
      windowType: "review",
      state: reviewState,
      icon: "ph-clock-countdown",
      readOnly: true,
      dealId: deal.id,
    });
  }

  // 4. Decision Markers (one per Referee decision on that deal row)
  for (const d of safeDecisions) {
    const decJson = (d.decisionJson as Record<string, any>) || {};
    const action = decJson.action || "DECISION";
    const rationale =
      decJson.rationale ||
      (Array.isArray(decJson.reasons) ? decJson.reasons.join(". ") : undefined) ||
      "Referee policy verdict executed.";
    const clauseRefs = Array.isArray(decJson.clauseRefs)
      ? decJson.clauseRefs
      : Array.isArray(decJson.citedClauses)
      ? decJson.citedClauses
      : [];
    const evidenceRefs = Array.isArray(decJson.evidenceRefs)
      ? decJson.evidenceRefs
      : Array.isArray(decJson.citedEvidence)
      ? decJson.citedEvidence
      : [];
    const decisionTime = d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt);

    scheduleEvents.push({
      id: `decision_${d.id}`,
      resourceId: d.dealId,
      name: `Referee Decision: ${action}`,
      startDate: decisionTime.toISOString(),
      endDate: decisionTime.toISOString(),
      state: "active",
      icon: "ph-scales",
      readOnly: true,
      isMilestone: true,
      action,
      shortRationale: rationale,
      clauseRefs,
      evidenceRefs,
      dealId: d.dealId,
    });
  }

  // 5. TimeRanges: Today Line
  const timeRanges: ScheduleTimeRange[] = [
    {
      id: "today_line",
      name: "Today",
      startDate: referenceTime.toISOString(),
      cls: "bryntum-today-line",
    },
  ];

  return {
    resources,
    events: scheduleEvents,
    timeRanges,
    updatedAt: referenceTime.toISOString(),
  };
}
