import type { DealContract } from "@/domain/contract";
import type { Decision } from "@/domain/decision";
import type { EvidenceRecord } from "@/domain/evidence";
import type { DealEvent } from "@/db/events";
import { env } from "@/config/env";

export interface DealContextForPolicy {
  id: string;
  status: string;
  contract: DealContract;
  amount: string;
  currency: string;
  deadlines?: {
    shipDeadline?: string | Date;
    deliveryDeadline?: string | Date;
    inspectionDeadline?: string | Date;
  } | null;
}

export interface PolicyEvaluationOptions {
  now?: Date;
  humanApprovalThreshold?: number;
}

export interface PolicyEvaluationResult {
  verdict: "ALLOWED" | "BLOCKED" | "ESCALATED";
  reasons: string[];
  violatedRules: string[];
}

const TERMINAL_STATES = ["RELEASED", "REFUNDED", "SETTLED", "CANCELLED"];
const MONEY_MOVING_ACTIONS = ["RELEASE", "REFUND", "PARTIAL_SETTLEMENT"];

/**
 * Deterministic Policy Engine implementing PE-1 through PE-8
 * as defined in requirements.md section 8.5.
 */
export function evaluatePolicy(
  deal: DealContextForPolicy,
  evidenceList: EvidenceRecord[],
  proposal: Decision,
  events: DealEvent[] = [],
  options?: PolicyEvaluationOptions
): PolicyEvaluationResult {
  const now = options?.now || new Date();
  const threshold =
    options?.humanApprovalThreshold ?? env.HUMAN_APPROVAL_THRESHOLD ?? 300;
  const isMoneyMoving = MONEY_MOVING_ACTIONS.includes(proposal.action);

  const reasons: string[] = [];
  const violatedRules: string[] = [];

  // PE-7: Terminal state guard
  if (TERMINAL_STATES.includes(deal.status)) {
    violatedRules.push("PE-7");
    reasons.push(
      `PE-7 Violation: Deal is already in terminal state '${deal.status}'. No further transitions or actions permitted.`
    );
    return { verdict: "BLOCKED", reasons, violatedRules };
  }

  // Pre-condition: Money cannot move if deal is not yet funded
  if (isMoneyMoving && (deal.status === "DRAFT" || deal.status === "AWAITING_PAYMENT")) {
    violatedRules.push("PE-7");
    reasons.push(
      `PE-7 Violation: Money cannot move when deal status is '${deal.status}'. Funds must be held first.`
    );
    return { verdict: "BLOCKED", reasons, violatedRules };
  }

  // PE-5: Amount above HUMAN_APPROVAL_THRESHOLD -> ESCALATED
  const numericAmount = parseFloat(deal.amount);
  if (isMoneyMoving && numericAmount > threshold) {
    violatedRules.push("PE-5");
    reasons.push(
      `PE-5 Escalation: Deal amount ${deal.amount} ${deal.currency} exceeds human approval threshold of ${threshold}. Escalating for human review.`
    );
    return { verdict: "ESCALATED", reasons, violatedRules };
  }

  // PE-6: Low confidence for money-moving actions -> ESCALATED
  if (isMoneyMoving && proposal.confidence < 0.7) {
    violatedRules.push("PE-6");
    reasons.push(
      `PE-6 Escalation: Confidence ${proposal.confidence.toFixed(2)} is below required 0.7 for money actions. Downgrading to ESCALATED.`
    );
    return { verdict: "ESCALATED", reasons, violatedRules };
  }

  // PE-1: Money actions require >= 1 valid evidenceRef or clauseRef that exists for this deal
  if (isMoneyMoving) {
    const totalRefs = proposal.clauseRefs.length + proposal.evidenceRefs.length;
    if (totalRefs === 0) {
      violatedRules.push("PE-1");
      reasons.push(
        "PE-1 Violation: Money-moving actions require at least 1 valid clauseRef or evidenceRef."
      );
    } else {
      // Validate clauseRefs exist in contract
      const validClauseIds = new Set(deal.contract.clauses.map((c) => c.id));
      for (const clauseRef of proposal.clauseRefs) {
        if (!validClauseIds.has(clauseRef)) {
          violatedRules.push("PE-1");
          reasons.push(`PE-1 Violation: Cited clause '${clauseRef}' does not exist in contract.`);
        }
      }

      // Validate evidenceRefs exist in evidenceList
      const validEvidenceIds = new Set(evidenceList.map((e) => e.id));
      for (const evRef of proposal.evidenceRefs) {
        if (!validEvidenceIds.has(evRef)) {
          violatedRules.push("PE-1");
          reasons.push(`PE-1 Violation: Cited evidence '${evRef}' does not exist for this deal.`);
        }
      }
    }
  }

  // PE-4: PARTIAL_SETTLEMENT percent must be between 10 and 90
  if (proposal.action === "PARTIAL_SETTLEMENT") {
    const share = proposal.params?.sellerSharePercent;
    if (share === undefined || share < 10 || share > 90) {
      violatedRules.push("PE-4");
      reasons.push(
        `PE-4 Violation: Partial settlement sellerSharePercent (${share}) must be between 10 and 90.`
      );
    }
  }

  // PE-2: RELEASE requirements
  if (proposal.action === "RELEASE") {
    const hasDeliveryEvidence = evidenceList.some(
      (e) =>
        e.kind === "tracking_snapshot" &&
        (e.contentText?.toLowerCase().includes("delivered") || false)
    );

    const hasBuyerConfirmation =
      events.some((ev) => ev.type === "BUYER_CONFIRMED") ||
      evidenceList.some((e) => e.source === "buyer" && e.kind === "system_event");

    const inspectionDeadline = deal.deadlines?.inspectionDeadline
      ? new Date(deal.deadlines.inspectionDeadline)
      : null;

    const inspectionElapsedNoClaim =
      inspectionDeadline !== null &&
      now.getTime() >= inspectionDeadline.getTime() &&
      deal.status !== "CLAIM_OPEN";

    const allowed = hasDeliveryEvidence || hasBuyerConfirmation || inspectionElapsedNoClaim;

    if (!allowed) {
      violatedRules.push("PE-2");
      reasons.push(
        "PE-2 Violation: RELEASE requires verified delivery evidence, explicit buyer confirmation, or elapsed inspection window without claim."
      );
    }
  }

  // PE-3: REFUND requirements
  if (proposal.action === "REFUND") {
    const shipDeadline = deal.deadlines?.shipDeadline
      ? new Date(deal.deadlines.shipDeadline)
      : null;
    const deliveryDeadline = deal.deadlines?.deliveryDeadline
      ? new Date(deal.deadlines.deliveryDeadline)
      : null;

    const shipDeadlinePassedNoTracking =
      deal.status === "FUNDS_HELD" &&
      shipDeadline !== null &&
      now.getTime() > shipDeadline.getTime();

    const hasDeliveryEvidence = evidenceList.some(
      (e) =>
        e.kind === "tracking_snapshot" &&
        (e.contentText?.toLowerCase().includes("delivered") || false)
    );

    const deliveryDeadlinePassedNoDelivery =
      deal.status === "SHIPPED" &&
      deliveryDeadline !== null &&
      now.getTime() > deliveryDeadline.getTime() &&
      !hasDeliveryEvidence;

    const trackingShowsReturnOrFailure = evidenceList.some(
      (e) =>
        e.kind === "tracking_snapshot" &&
        (e.contentText?.toLowerCase().includes("returned") ||
          e.contentText?.toLowerCase().includes("return to sender") ||
          e.contentText?.toLowerCase().includes("failed delivery"))
    );

    const buyerClaimApproved =
      deal.status === "CLAIM_OPEN" &&
      proposal.evidenceRefs.length > 0;

    const allowed =
      shipDeadlinePassedNoTracking ||
      deliveryDeadlinePassedNoDelivery ||
      trackingShowsReturnOrFailure ||
      buyerClaimApproved;

    if (!allowed) {
      violatedRules.push("PE-3");
      reasons.push(
        "PE-3 Violation: REFUND requires passed ship deadline without tracking, passed delivery deadline without delivery, tracking return/failure, or evaluated claim."
      );
    }
  }

  // PE-8: Prompt injection defense
  // Verify rationale or untrusted inputs do not attempt to override policy rules or modify contracts
  const injectionPatterns = [
    /ignore (all )?(previous|the) (instructions|rules)/i,
    /system override/i,
    /admin mode/i,
    /send (funds|money) to/i,
    /change (price|amount|destination|terms)/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(proposal.rationale)) {
      violatedRules.push("PE-8");
      reasons.push(
        "PE-8 Violation: Prohibited injection or contract alteration instruction detected in rationale."
      );
      break;
    }
  }

  if (violatedRules.length > 0) {
    return {
      verdict: "BLOCKED",
      reasons,
      violatedRules,
    };
  }

  reasons.push(`Policy evaluation PASSED for action '${proposal.action}'.`);
  return {
    verdict: "ALLOWED",
    reasons,
    violatedRules: [],
  };
}

