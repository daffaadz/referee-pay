import { NextResponse } from "next/server";
import { env } from "@/config/env";
import { getActiveDeals, updateDealStatus, addEvidence } from "@/db/queries";
import { getEventsForDeal, appendDealEvent } from "@/db/events";
import { transition, type DealStatus } from "@/domain/state-machine";
import type { DealContract } from "@/domain/contract";
import { runReferee } from "@/agent/referee";
import { executeDecision } from "@/agent/executor";
import { verifyTrackingWithKernel } from "@/integrations/kernel/client";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // Authenticate with internal sweep secret
    const secretHeader =
      req.headers.get("x-internal-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (secretHeader !== env.INTERNAL_SWEEP_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid internal sweep secret" },
        { status: 401 }
      );
    }

    const activeDeals = await getActiveDeals();
    const actionsTaken: Array<{
      dealId: string;
      previousStatus: string;
      newStatus: string;
      event: string;
      actionExecuted?: string;
    }> = [];

    const timeScale = env.DEMO_MODE ? env.DEMO_TIME_SCALE || 1 : 1;

    for (const deal of activeDeals) {
      const contract = deal.contractJson as DealContract;
      const events = await getEventsForDeal(deal.id);

      // Compute virtual accelerated time for demo mode
      const realElapsedMs = Date.now() - deal.createdAt.getTime();
      const scaledElapsedMs = realElapsedMs * timeScale;
      const effectiveNow = new Date(deal.createdAt.getTime() + scaledElapsedMs);

      const deadlines = (deal.deadlinesJson as Record<string, string> | null) || {};

      // 1. FUNDS_HELD -> Check Ship Deadline
      if (deal.status === "FUNDS_HELD") {
        const shipDeadline = deadlines.shipDeadline
          ? new Date(deadlines.shipDeadline)
          : new Date(
              deal.createdAt.getTime() +
                (contract.terms.shipDeadlineDays || 3) * 86400000
            );

        if (effectiveNow.getTime() >= shipDeadline.getTime()) {
          const alreadyExpired = events.some(
            (e) => e.type === "SHIP_DEADLINE_EXPIRED"
          );
          if (!alreadyExpired) {
            await appendDealEvent(deal.id, "SHIP_DEADLINE_EXPIRED", {
              effectiveNow: effectiveNow.toISOString(),
              shipDeadline: shipDeadline.toISOString(),
            });

            // Trigger Referee decision loop
            const refereeResult = await runReferee(deal.id, "DEADLINE_TICK");
            const execResult = await executeDecision({
              dealId: deal.id,
              trigger: "DEADLINE_TICK",
              decision: refereeResult.decision,
              model: refereeResult.model,
              promptVersion: refereeResult.promptVersion,
              options: { now: effectiveNow },
            });

            actionsTaken.push({
              dealId: deal.id,
              previousStatus: "FUNDS_HELD",
              newStatus: execResult.newStatus,
              event: "SHIP_DEADLINE_EXPIRED",
              actionExecuted: execResult.actionExecuted,
            });
          }
        }
      }

      // 2. SHIPPED -> Verify Tracking or Check Delivery Deadline
      else if (deal.status === "SHIPPED") {
        const shipEvent = events.find((e) => e.type === "SHIPMENT_ADDED");
        const trackingNumber =
          (shipEvent?.payload as any)?.trackingNumber || "MCK-123456";
        const carrier =
          (shipEvent?.payload as any)?.carrier || "Mock Carrier";

        // Try checking tracking with Kernel
        let verifiedDelivered = false;
        try {
          const kernelResult = await verifyTrackingWithKernel(trackingNumber, carrier);
          if (kernelResult.status === "Delivered") {
            verifiedDelivered = true;
            const evidenceId = `E_TRK_${Date.now().toString().slice(-4)}`;

            await addEvidence({
              id: evidenceId,
              dealId: deal.id,
              kind: "tracking_snapshot",
              source: carrier,
              contentText: kernelResult.statusText,
              contentHash: kernelResult.contentHash,
              artifactUrl: kernelResult.screenshotUrl || kernelResult.replayUrl,
              createdAt: kernelResult.verifiedAt,
            });

            const trans = transition("SHIPPED", {
              dealId: deal.id,
              type: "DELIVERY_VERIFIED",
              payload: { trackingNumber, carrier, evidenceId },
            });

            if (trans.ok) {
              const inspectionWindowDays = contract.terms.inspectionWindowDays || 2;
              const inspectionDeadline = new Date(
                effectiveNow.getTime() + inspectionWindowDays * 86400000
              );

              await updateDealStatus(deal.id, trans.newStatus, {
                ...deadlines,
                inspectionDeadline: inspectionDeadline.toISOString(),
              });

              await appendDealEvent(deal.id, "DELIVERY_VERIFIED", {
                evidenceId,
                trackingNumber,
                carrier,
                inspectionDeadline: inspectionDeadline.toISOString(),
              });

              actionsTaken.push({
                dealId: deal.id,
                previousStatus: "SHIPPED",
                newStatus: "DELIVERED",
                event: "DELIVERY_VERIFIED",
                actionExecuted: "TRANSITION_TO_DELIVERED",
              });
            }
          }
        } catch (verifErr: any) {
          console.warn("Sweeper tracking check notice:", verifErr.message);
        }

        // If not delivered, check delivery deadline
        if (!verifiedDelivered) {
          const deliveryDeadline = deadlines.deliveryDeadline
            ? new Date(deadlines.deliveryDeadline)
            : new Date(
                deal.createdAt.getTime() +
                  (contract.terms.deliveryDeadlineDays || 14) * 86400000
              );

          if (effectiveNow.getTime() >= deliveryDeadline.getTime()) {
            const alreadyExpired = events.some(
              (e) => e.type === "DELIVERY_DEADLINE_EXPIRED"
            );
            if (!alreadyExpired) {
              await appendDealEvent(deal.id, "DELIVERY_DEADLINE_EXPIRED", {
                effectiveNow: effectiveNow.toISOString(),
                deliveryDeadline: deliveryDeadline.toISOString(),
              });

              const refereeResult = await runReferee(deal.id, "DEADLINE_TICK");
              const execResult = await executeDecision({
                dealId: deal.id,
                trigger: "DEADLINE_TICK",
                decision: refereeResult.decision,
                model: refereeResult.model,
                promptVersion: refereeResult.promptVersion,
                options: { now: effectiveNow },
              });

              actionsTaken.push({
                dealId: deal.id,
                previousStatus: "SHIPPED",
                newStatus: execResult.newStatus,
                event: "DELIVERY_DEADLINE_EXPIRED",
                actionExecuted: execResult.actionExecuted,
              });
            }
          }
        }
      }

      // 3. DELIVERED -> Check Inspection Window Expiration
      else if (deal.status === "DELIVERED") {
        const inspectionDeadline = deadlines.inspectionDeadline
          ? new Date(deadlines.inspectionDeadline)
          : new Date(
              deal.createdAt.getTime() +
                (contract.terms.inspectionWindowDays || 2) * 86400000
            );

        if (effectiveNow.getTime() >= inspectionDeadline.getTime()) {
          const alreadyPassed = events.some(
            (e) => e.type === "INSPECTION_PASSED"
          );
          if (!alreadyPassed) {
            await appendDealEvent(deal.id, "INSPECTION_PASSED", {
              effectiveNow: effectiveNow.toISOString(),
              inspectionDeadline: inspectionDeadline.toISOString(),
            });

            // Trigger Referee: should propose RELEASE
            const refereeResult = await runReferee(deal.id, "DEADLINE_TICK");
            const execResult = await executeDecision({
              dealId: deal.id,
              trigger: "DEADLINE_TICK",
              decision: refereeResult.decision,
              model: refereeResult.model,
              promptVersion: refereeResult.promptVersion,
              options: { now: effectiveNow },
            });

            actionsTaken.push({
              dealId: deal.id,
              previousStatus: "DELIVERED",
              newStatus: execResult.newStatus,
              event: "INSPECTION_PASSED",
              actionExecuted: execResult.actionExecuted,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      timeScale,
      activeDealsScanned: activeDeals.length,
      actionsTaken,
    });
  } catch (error: any) {
    console.error("Error running deadline sweeper:", error);
    return NextResponse.json(
      { error: "Deadline sweep failed", message: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

