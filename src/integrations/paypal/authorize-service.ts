/**
 * Shared PayPal order authorization and escrow hold processing.
 * Verified against PayPal docs:
 * https://developer.paypal.com/docs/api/orders/v2/#orders_authorize
 * https://developer.paypal.com/checkout/delay-capture
 *
 * Referenced requirement: FR-3, FR-9
 */
import { getDealById, updateDealStatus, recordPayment } from "../../db/queries";
import { appendDealEvent } from "../../db/events";
import { fundsHold } from "./funds-hold";
import { transition, DealStatus } from "../../domain/state-machine";
import type { deals } from "../../db/schema";

export interface AuthorizeDealResult {
  ok: boolean;
  dealStatus?: DealStatus;
  authorizationId?: string;
  alreadyProcessed?: boolean;
  error?: string;
}

export async function processPaymentAuthorization(
  dealOrId: string | typeof deals.$inferSelect,
  orderId: string
): Promise<AuthorizeDealResult> {
  const deal = typeof dealOrId === "string" ? await getDealById(dealOrId) : dealOrId;
  if (!deal) {
    return { ok: false, error: `Deal '${dealOrId}' not found` };
  }

  // Idempotent check: if already in FUNDS_HELD or later, do not re-authorize
  if (deal.status !== "AWAITING_PAYMENT") {
    if (deal.status === "FUNDS_HELD") {
      return { ok: true, dealStatus: "FUNDS_HELD", alreadyProcessed: true };
    }
    return {
      ok: false,
      error: `Cannot authorize payment for deal in status '${deal.status}'. Expected 'AWAITING_PAYMENT'.`,
    };
  }

  // 1. Authorize the PayPal order
  const authResult = await fundsHold.authorizeOrder({
    dealId: deal.id,
    orderId,
  });

  // 2. Verify authorized amount matches contract terms (PE-8 / Money Safety)
  if (
    authResult.amount &&
    (authResult.amount.amount !== deal.amount ||
      authResult.amount.currency !== deal.currency)
  ) {
    return {
      ok: false,
      error: `Amount mismatch: Authorized ${authResult.amount.amount} ${authResult.amount.currency} does not match deal ${deal.amount} ${deal.currency}`,
    };
  }

  // 3. Record authorized payment in payments table
  await recordPayment({
    dealId: deal.id,
    orderId,
    authorizationId: authResult.authorizationId,
    status: authResult.status || "AUTHORIZED",
  });

  // 4. Execute state transition: AWAITING_PAYMENT -> FUNDS_HELD
  const transitionResult = transition(deal.status as DealStatus, {
    dealId: deal.id,
    type: "PAYMENT_AUTHORIZED",
    payload: {
      orderId,
      authorizationId: authResult.authorizationId,
    },
  });

  if (!transitionResult.ok) {
    return { ok: false, error: `State transition failed: ${transitionResult.error}` };
  }

  // 5. Persist status change to FUNDS_HELD
  await updateDealStatus(deal.id, transitionResult.newStatus);

  // 6. Append to immutable audit event log
  await appendDealEvent(deal.id, "PAYMENT_AUTHORIZED", {
    orderId,
    authorizationId: authResult.authorizationId,
  });

  return {
    ok: true,
    dealStatus: transitionResult.newStatus,
    authorizationId: authResult.authorizationId,
  };
}
