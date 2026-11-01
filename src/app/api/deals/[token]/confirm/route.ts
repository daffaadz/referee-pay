import { NextRequest, NextResponse } from "next/server";
import { getDealByToken, addEvidence } from "@/db/queries";
import { appendDealEvent } from "@/db/events";
import { runReferee } from "@/agent/referee";
import { executeDecision } from "@/agent/executor";
import { hashEvidenceContent } from "@/domain/evidence";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const resolved = await getDealByToken(token);
    if (!resolved) {
      return NextResponse.json({ error: "Deal not found or invalid token" }, { status: 404 });
    }

    const { deal, role } = resolved;

    // FR-8: Buyer action (early confirmation)
    if (role !== "buyer") {
      return NextResponse.json({ error: "Only the buyer can confirm receipt" }, { status: 403 });
    }

    if (deal.status !== "FUNDS_HELD" && deal.status !== "SHIPPED" && deal.status !== "DELIVERED") {
      return NextResponse.json(
        { error: `Cannot confirm receipt in deal status '${deal.status}'` },
        { status: 400 }
      );
    }

    // Append buyer confirmation audit event
    await appendDealEvent(deal.id, "BUYER_CONFIRMED", {
      confirmedAt: new Date().toISOString(),
      role: "buyer",
    });

    // Record buyer confirmation as verifiable evidence
    const evidenceId = `E_CONF_${Date.now().toString().slice(-4)}`;
    const confText = "Buyer explicitly confirmed receipt of item via Deal Room.";
    await addEvidence({
      id: evidenceId,
      dealId: deal.id,
      kind: "system_event",
      source: "buyer",
      contentText: confText,
      contentHash: hashEvidenceContent(confText),
      createdAt: new Date(),
    });

    // Trigger autonomous Referee arbitration for BUYER_CONFIRMED
    const refereeResult = await runReferee(deal.id, "BUYER_CONFIRMED");

    // Execute through deterministic Policy Engine and executeDecision
    const execResult = await executeDecision({
      dealId: deal.id,
      trigger: "BUYER_CONFIRMED",
      decision: refereeResult.decision,
      model: refereeResult.model,
      promptVersion: refereeResult.promptVersion,
    });

    return NextResponse.json({
      ok: true,
      dealStatus: execResult.newStatus,
      decision: refereeResult.decision,
      execution: execResult,
    });
  } catch (error: any) {
    console.error("Error confirming receipt:", error.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm receipt" },
      { status: 500 }
    );
  }
}
