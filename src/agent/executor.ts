import crypto from "crypto";
import type { Decision, PolicyVerdict } from "@/domain/decision";
import { evaluatePolicy, type PolicyEvaluationOptions } from "./policy-engine";
import { transition, type DealStatus } from "@/domain/state-machine";
import type { DealContract } from "@/domain/contract";
import { Money } from "@/domain/money";
import {
  getDealById,
  getEvidenceForDeal,
  getPaymentByDealId,
  updatePayment,
  updateDealStatus,
  updateDealDeadlines,
  recordDecision,
} from "@/db/queries";
import { getEventsForDeal, appendEvent } from "@/db/events";
import { fundsHold as defaultFundsHold, type FundsHold } from "@/integrations/paypal/funds-hold";

export interface ExecuteDecisionParams {
  dealId: string;
  trigger: string;
  decision: Decision;
  model?: string;
  promptVersion?: string;
  fundsHold?: FundsHold;
  options?: PolicyEvaluationOptions;
}

export interface ExecuteDecisionResult {
  decisionId: string;
  verdict: PolicyVerdict;
  reasons: string[];
  actionExecuted?: string;
  paypalResult?: Record<string, unknown>;
  previousStatus: string;
  newStatus: string;
}

/**
 * Evaluates the policy engine against an agent-proposed decision,
 * and if ALLOWED, executes the required PayPal funds-hold operation
 * (capture/payout for release, void for refund) and state machine transition.
 *
 * NON-NEGOTIABLE SAFETY:
 * 1. PayPal is never touched unless policyVerdict === "ALLOWED".
 * 2. All deal status updates must go through transition().
 * 3. Idempotent PayPal requests using makeIdempotencyKey().
 */
export async function executeDecision(
  params: ExecuteDecisionParams
): Promise<ExecuteDecisionResult> {
  const {
    dealId,
    trigger,
    decision,
    model = "referee-arbiter",
    promptVersion = "v1.0.0",
    fundsHold = defaultFundsHold,
    options,
  } = params;

  const deal = await getDealById(dealId);
  if (!deal) {
    throw new Error(`Cannot execute decision: Deal ${dealId} does not exist.`);
  }

  const evidenceList = await getEvidenceForDeal(dealId);
  const events = await getEventsForDeal(dealId);
  const payment = await getPaymentByDealId(dealId);

  const contract = deal.contractJson as DealContract;
  const deadlines = deal.deadlinesJson as {
    shipDeadline?: string | Date;
    deliveryDeadline?: string | Date;
    inspectionDeadline?: string | Date;
  } | null;

  // Deterministic Policy Check
  const policyResult = evaluatePolicy(
    {
      id: deal.id,
      status: deal.status,
      contract,
      amount: deal.amount,
      currency: deal.currency,
      deadlines,
    },
    evidenceList,
    decision,
    events,
    options
  );

  const decisionId = `dec_${crypto.randomUUID()}`;
  let currentStatus = deal.status as DealStatus;
  let newStatus = currentStatus;
  let paypalResult: Record<string, unknown> | undefined;
  let actionExecuted: string | undefined;

  if (policyResult.verdict === "ALLOWED") {
    if (decision.action === "RELEASE") {
      let authId = payment?.authorizationId;
      if (!authId) {
        const payAuthEvt = events.find((e) => e.type === "PAYMENT_AUTHORIZED");
        authId = (payAuthEvt?.payload as any)?.authorizationId;
      }

      if (!authId) {
        throw new Error(
          `Cannot release funds for deal ${dealId}: Missing PayPal authorizationId.`
        );
      }

      // Money release: Capture + Payout to seller
      const relRes = await fundsHold.release({
        dealId: deal.id,
        authorizationId: authId,
        amount: contract.item.price,
        sellerPaypalEmail: contract.seller.paypalEmail,
        finalCapture: true,
      });

      paypalResult = relRes as unknown as Record<string, unknown>;
      actionExecuted = "RELEASE_CAPTURED_AND_PAID";

      // Persist capture and payout IDs
      await updatePayment(payment.id, {
        captureId: relRes.captureId,
        payoutBatchId: relRes.payoutBatchId,
        status: "CAPTURED",
      });

      // State machine transition
      const transResult = transition(currentStatus, {
        dealId: deal.id,
        type: "DECISION_RELEASE",
        payload: { decisionId, captureId: relRes.captureId },
      });

      if (transResult.ok) {
        newStatus = transResult.newStatus;
        await updateDealStatus(deal.id, newStatus);
        await appendEvent({
          dealId: deal.id,
          type: "DECISION_RELEASE",
          payload: { decisionId, captureId: relRes.captureId },
        });
      }
    } else if (decision.action === "REFUND") {
      let authId = payment?.authorizationId;
      if (!authId) {
        const payAuthEvt = events.find((e) => e.type === "PAYMENT_AUTHORIZED");
        authId = (payAuthEvt?.payload as any)?.authorizationId;
      }

      if (!authId) {
        throw new Error(
          `Cannot refund deal ${dealId}: Missing PayPal authorizationId.`
        );
      }

      // Money refund: Void authorization
      const refRes = await fundsHold.refund({
        dealId: deal.id,
        authorizationId: authId,
        note: decision.rationale,
      });

      paypalResult = refRes as unknown as Record<string, unknown>;
      actionExecuted = "REFUND_VOIDED";

      // Persist void status
      await updatePayment(payment.id, {
        status: "VOIDED",
      });

      // State machine transition
      const transResult = transition(currentStatus, {
        dealId: deal.id,
        type: "DECISION_REFUND",
        payload: { decisionId },
      });

      if (transResult.ok) {
        newStatus = transResult.newStatus;
        await updateDealStatus(deal.id, newStatus);
        await appendEvent({
          dealId: deal.id,
          type: "DECISION_REFUND",
          payload: { decisionId },
        });
      }
    } else if (decision.action === "PARTIAL_SETTLEMENT") {
      let authId = payment?.authorizationId;
      if (!authId) {
        const payAuthEvt = events.find((e) => e.type === "PAYMENT_AUTHORIZED");
        authId = (payAuthEvt?.payload as any)?.authorizationId;
      }

      if (!authId) {
        throw new Error(
          `Cannot execute partial settlement for deal ${dealId}: Missing PayPal authorizationId.`
        );
      }

      const percent = decision.params?.sellerSharePercent ?? 50;
      const sellerShare = Money.percent(contract.item.price, percent);

      // FR-P1-1: Capture sellerShare with final_capture: true, voiding remainder to buyer
      // Verified against PayPal docs: https://developer.paypal.com/checkout/delay-capture
      const relRes = await fundsHold.release({
        dealId: deal.id,
        authorizationId: authId,
        amount: sellerShare,
        sellerPaypalEmail: contract.seller.paypalEmail,
        finalCapture: true,
      });

      paypalResult = relRes as unknown as Record<string, unknown>;
      actionExecuted = `PARTIAL_SETTLEMENT_${percent}_PERCENT`;

      if (payment) {
        await updatePayment(payment.id, {
          captureId: relRes.captureId,
          payoutBatchId: relRes.payoutBatchId,
          status: "CAPTURED",
        });
      }

      const transResult = transition(currentStatus, {
        dealId: deal.id,
        type: "DECISION_SETTLE",
        payload: { decisionId, captureId: relRes.captureId, sellerSharePercent: percent },
      });

      if (transResult.ok) {
        newStatus = transResult.newStatus;
        await updateDealStatus(deal.id, newStatus);
        await appendEvent({
          dealId: deal.id,
          type: "DECISION_SETTLE",
          payload: { decisionId, captureId: relRes.captureId, sellerSharePercent: percent },
        });
      }
    } else if (decision.action === "EXTEND_DEADLINE") {
      // FR-P1-5: Extend delivery deadline by 3 days
      actionExecuted = "EXTEND_DEADLINE";
      const currentDeadlines = (deal.deadlinesJson as Record<string, string>) || {};
      const currentDelivery = currentDeadlines.deliveryDeadline
        ? new Date(currentDeadlines.deliveryDeadline)
        : new Date();
      const extendedDelivery = new Date(currentDelivery.getTime() + 86400000 * 3);

      const updatedDeadlines = {
        ...currentDeadlines,
        deliveryDeadline: extendedDelivery.toISOString(),
        deadlineExtendedCount: (Number(currentDeadlines.deadlineExtendedCount) || 0) + 1,
      };

      await updateDealDeadlines(deal.id, updatedDeadlines);

      const transResult = transition(currentStatus, {
        dealId: deal.id,
        type: "DEADLINE_EXTENDED",
        payload: { decisionId, extendedDelivery: extendedDelivery.toISOString() },
      });

      if (transResult.ok) {
        newStatus = transResult.newStatus;
        await updateDealStatus(deal.id, newStatus);
        await appendEvent({
          dealId: deal.id,
          type: "DEADLINE_EXTENDED",
          payload: { decisionId, extendedDelivery: extendedDelivery.toISOString() },
        });
      }
    } else if (decision.action === "WAIT") {
      actionExecuted = "WAIT";
    } else if (decision.action === "REQUEST_EVIDENCE") {
      // FR-P1-2: Request-evidence loop
      actionExecuted = "REQUEST_EVIDENCE";
      await appendEvent({
        dealId: deal.id,
        type: "MESSAGE_SENT",
        payload: {
          role: "system",
          note: `Referee requested additional evidence: ${decision.rationale}`,
        },
      });
    } else if (decision.action === "ESCALATE") {
      actionExecuted = "ESCALATED";
      const transResult = transition(currentStatus, {
        dealId: deal.id,
        type: "DECISION_ESCALATE",
        payload: { decisionId, reasons: [decision.rationale] },
      });
      if (transResult.ok) {
        newStatus = transResult.newStatus;
        await updateDealStatus(deal.id, newStatus);
        await appendEvent({
          dealId: deal.id,
          type: "DECISION_ESCALATE",
          payload: { decisionId, reasons: [decision.rationale] },
        });
      }
    }
  } else if (policyResult.verdict === "ESCALATED") {
    // Escalate to human review without moving money
    actionExecuted = "ESCALATED";
    const transResult = transition(currentStatus, {
      dealId: deal.id,
      type: "DECISION_ESCALATE",
      payload: { decisionId, reasons: policyResult.reasons },
    });

    if (transResult.ok) {
      newStatus = transResult.newStatus;
      await updateDealStatus(deal.id, newStatus);
      await appendEvent({
        dealId: deal.id,
        type: "DECISION_ESCALATE",
        payload: { decisionId, reasons: policyResult.reasons },
      });
    }
  } else {
    // BLOCKED: money does NOT move, audit logged
    actionExecuted = "BLOCKED";
    await appendEvent({
      dealId: deal.id,
      type: "MESSAGE_SENT",
      payload: {
        role: "system",
        note: `Decision proposal ${decision.action} was BLOCKED by Policy Engine: ${policyResult.reasons.join(
          "; "
        )}`,
      },
    });
  }

  // Persist auditable decision record in decisions table
  await recordDecision({
    id: decisionId,
    dealId: deal.id,
    trigger,
    decision,
    policyVerdict: policyResult.verdict,
    policyReasons: policyResult.reasons,
    model,
    promptVersion,
    createdAt: new Date(),
  });

  return {
    decisionId,
    verdict: policyResult.verdict,
    reasons: policyResult.reasons,
    actionExecuted,
    paypalResult,
    previousStatus: currentStatus,
    newStatus,
  };
}
