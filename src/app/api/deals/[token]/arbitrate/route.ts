import { NextResponse } from "next/server";
import { getDealByToken } from "@/db/queries";
import { runReferee } from "@/agent/referee";
import { executeDecision } from "@/agent/executor";

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const resolved = await getDealByToken(token);

    if (!resolved) {
      return NextResponse.json({ error: "Deal not found or invalid token" }, { status: 404 });
    }

    let trigger = "MANUAL_RERUN";
    try {
      const body = await req.json();
      if (body.trigger) {
        trigger = body.trigger;
      }
    } catch {
      // JSON body is optional
    }

    // Step 1: Run Referee agent loop to analyze contract & evidence
    const refereeResult = await runReferee(resolved.deal.id, trigger);

    // Step 2: Pass decision to Policy Engine and execute through FundsHold if ALLOWED
    const executionResult = await executeDecision({
      dealId: resolved.deal.id,
      trigger,
      decision: refereeResult.decision,
      model: refereeResult.model,
      promptVersion: refereeResult.promptVersion,
    });

    return NextResponse.json({
      success: true,
      decision: refereeResult.decision,
      execution: executionResult,
    });
  } catch (error: any) {
    console.error("Error executing arbitration:", error);
    return NextResponse.json(
      { error: "Arbitration execution failed", message: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

