import { z } from "zod";

export const dealStatusSchema = z.enum([
  "DRAFT",
  "AWAITING_PAYMENT",
  "FUNDS_HELD",
  "SHIPPED",
  "DELIVERED",
  "CLAIM_OPEN",
  "ESCALATED",
  "RELEASED",
  "REFUNDED",
  "SETTLED",
  "CANCELLED",
]);

export type DealStatus = z.infer<typeof dealStatusSchema>;

export const TERMINAL_STATUSES: ReadonlySet<DealStatus> = new Set([
  "RELEASED",
  "REFUNDED",
  "SETTLED",
  "CANCELLED",
]);

export function isTerminalStatus(status: DealStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export type DealEventType =
  | "CONTRACT_CREATED"
  | "PAYMENT_AUTHORIZED"
  | "CANCEL"
  | "SHIPMENT_ADDED"
  | "SHIP_DEADLINE_EXPIRED"
  | "DELIVERY_VERIFIED"
  | "DELIVERY_FAILED"
  | "DELIVERY_DEADLINE_EXPIRED"
  | "BUYER_CONFIRMED"
  | "INSPECTION_PASSED"
  | "CLAIM_OPENED"
  | "DECISION_RELEASE"
  | "DECISION_REFUND"
  | "DECISION_SETTLE"
  | "DECISION_ESCALATE"
  | "DEADLINE_EXTENDED"
  | "EVIDENCE_ADDED"
  | "MESSAGE_SENT";

export interface DealEvent {
  id?: string;
  dealId: string;
  type: DealEventType;
  payload?: Record<string, unknown>;
  createdAt?: Date;
}

export interface TransitionSuccess {
  ok: true;
  previousStatus: DealStatus;
  newStatus: DealStatus;
  event: DealEvent;
}

export interface TransitionFailure {
  ok: false;
  error: string;
  currentStatus: DealStatus;
  attemptedEventType: DealEventType;
}

export type TransitionResult = TransitionSuccess | TransitionFailure;

/**
 * State Transition Table defining valid transitions from currentStatus + eventType -> newStatus.
 */
const TRANSITION_TABLE: Partial<Record<DealStatus, Partial<Record<DealEventType, DealStatus>>>> = {
  DRAFT: {
    CONTRACT_CREATED: "AWAITING_PAYMENT",
    CANCEL: "CANCELLED",
  },
  AWAITING_PAYMENT: {
    PAYMENT_AUTHORIZED: "FUNDS_HELD",
    CANCEL: "CANCELLED",
  },
  FUNDS_HELD: {
    SHIPMENT_ADDED: "SHIPPED",
    SHIP_DEADLINE_EXPIRED: "REFUNDED",
    BUYER_CONFIRMED: "RELEASED",
    DECISION_RELEASE: "RELEASED",
    DECISION_REFUND: "REFUNDED",
    DECISION_ESCALATE: "ESCALATED",
  },
  SHIPPED: {
    DELIVERY_VERIFIED: "DELIVERED",
    DELIVERY_FAILED: "REFUNDED",
    DELIVERY_DEADLINE_EXPIRED: "REFUNDED",
    BUYER_CONFIRMED: "RELEASED",
    DECISION_RELEASE: "RELEASED",
    DECISION_REFUND: "REFUNDED",
    DECISION_ESCALATE: "ESCALATED",
    DEADLINE_EXTENDED: "SHIPPED",
  },
  DELIVERED: {
    INSPECTION_PASSED: "RELEASED",
    BUYER_CONFIRMED: "RELEASED",
    CLAIM_OPENED: "CLAIM_OPEN",
    DECISION_RELEASE: "RELEASED",
    DECISION_REFUND: "REFUNDED",
    DECISION_ESCALATE: "ESCALATED",
  },
  CLAIM_OPEN: {
    DECISION_RELEASE: "RELEASED",
    DECISION_REFUND: "REFUNDED",
    DECISION_SETTLE: "SETTLED",
    DECISION_ESCALATE: "ESCALATED",
  },
  ESCALATED: {
    DECISION_RELEASE: "RELEASED",
    DECISION_REFUND: "REFUNDED",
    DECISION_SETTLE: "SETTLED",
  },
};

/**
 * Executes a deterministic state machine transition for a deal per requirements.md 5.2.
 * Validates that the deal is not in a terminal state and that the event is legal.
 */
export function transition(currentStatus: DealStatus, event: DealEvent): TransitionResult {
  // PE-7: Deal must not be in a terminal state
  if (isTerminalStatus(currentStatus)) {
    return {
      ok: false,
      error: `Illegal transition: Deal is already in terminal state "${currentStatus}". No further transitions allowed.`,
      currentStatus,
      attemptedEventType: event.type,
    };
  }

  // Non-state-advancing audit events are permitted on any active state
  if (event.type === "EVIDENCE_ADDED" || event.type === "MESSAGE_SENT") {
    return {
      ok: true,
      previousStatus: currentStatus,
      newStatus: currentStatus,
      event,
    };
  }

  const validNextState = TRANSITION_TABLE[currentStatus]?.[event.type];

  if (!validNextState) {
    return {
      ok: false,
      error: `Illegal transition: Event "${event.type}" is not allowed from status "${currentStatus}".`,
      currentStatus,
      attemptedEventType: event.type,
    };
  }

  return {
    ok: true,
    previousStatus: currentStatus,
    newStatus: validNextState,
    event,
  };
}

