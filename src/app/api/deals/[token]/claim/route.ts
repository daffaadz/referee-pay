import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDealByToken, updateDealStatus, addEvidence } from "@/db/queries";
import { appendDealEvent } from "@/db/events";
import { transition, DealStatus } from "@/domain/state-machine";
import { hashEvidenceContent } from "@/domain/evidence";
import { runReferee } from "@/agent/referee";
import { executeDecision } from "@/agent/executor";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const claimBodySchema = z.object({
  reason: z.string().min(1, "Claim reason is required").max(1000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`claim:${clientIp}`, { maxRequests: 5, windowMs: 60_000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many claim attempts. Please wait.", retryAfterMs: rateLimit.resetMs },
        { status: 429 }
      );
    }
    const { token } = await context.params;
    const resolved = await getDealByToken(token);
    if (!resolved) {
      return NextResponse.json({ error: "Deal not found or invalid token" }, { status: 404 });
    }

    const { deal, role } = resolved;

    // FR-8: Buyer opens a claim during inspection window
    if (role !== "buyer") {
      return NextResponse.json({ error: "Only the buyer can open a claim" }, { status: 403 });
    }

    // Verify inspection window has not expired
    const deadlines = (deal.deadlinesJson as Record<string, unknown> | null) || {};
    if (typeof deadlines.inspectionDeadline === "string") {
      const deadline = new Date(deadlines.inspectionDeadline);
      if (Date.now() > deadline.getTime()) {
        return NextResponse.json(
          { error: "Inspection window has expired. Cannot open a claim." },
          { status: 400 }
        );
      }
    }

    const body = await request.json();
    const parsed = claimBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid claim payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const transitionResult = transition(deal.status as DealStatus, {
      dealId: deal.id,
      type: "CLAIM_OPENED",
      payload: { reason: parsed.data.reason },
    });

    if (!transitionResult.ok) {
      return NextResponse.json({ error: transitionResult.error }, { status: 400 });
    }

    // Persist new status CLAIM_OPEN
    await updateDealStatus(deal.id, transitionResult.newStatus);

    // Save claim as evidence (E...)
    const evidenceId = `E_CLAIM_${Date.now().toString().slice(-4)}`;
    await addEvidence({
      id: evidenceId,
      dealId: deal.id,
      kind: "buyer_claim",
      source: "buyer",
      contentText: parsed.data.reason,
      contentHash: hashEvidenceContent(parsed.data.reason),
      createdAt: new Date(),
    });

    // Append audit event
    await appendDealEvent(deal.id, "CLAIM_OPENED", {
      reason: parsed.data.reason,
      evidenceId,
    });

    // Trigger Referee to evaluate the newly opened claim
    let arbitrationResult = null;
    try {
      const refereeResult = await runReferee(deal.id, "CLAIM_OPENED");
      const execResult = await executeDecision({
        dealId: deal.id,
        trigger: "CLAIM_OPENED",
        decision: refereeResult.decision,
        model: refereeResult.model,
        promptVersion: refereeResult.promptVersion,
      });

      arbitrationResult = {
        decision: refereeResult.decision,
        execution: execResult,
      };
    } catch (refErr: any) {
      console.warn("Notice: Claim arbitration error:", refErr.message);
    }

    return NextResponse.json({
      ok: true,
      dealStatus: transitionResult.newStatus,
      evidenceId,
      arbitration: arbitrationResult,
    });
  } catch (error: any) {
    console.error("Error opening claim:", error.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to open claim" },
      { status: 500 }
    );
  }
}
