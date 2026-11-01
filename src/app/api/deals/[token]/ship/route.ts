import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDealByToken, updateDealStatus, getEvidenceForDeal, addEvidence } from "@/db/queries";
import { appendDealEvent } from "@/db/events";
import { transition, DealStatus } from "@/domain/state-machine";
import { verifyTrackingWithKernel } from "@/integrations/kernel/client";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/domain/session";

export const maxDuration = 60;

const shipBodySchema = z.object({
  carrier: z.string().min(1, "Carrier is required"),
  trackingNumber: z.string().min(1, "Tracking number is required"),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const resolved = await getDealByToken(token);
    if (!resolved) {
      return NextResponse.json({ error: "Deal not found or invalid token" }, { status: 404 });
    }

    const { deal, role } = resolved;

    // FR-4: Allowed only in FUNDS_HELD and only by seller
    if (role !== "seller") {
      return NextResponse.json({ error: "Only the seller can submit shipment tracking" }, { status: 403 });
    }

    // Ownership check: if deal was created by an authenticated seller, enforce session match
    if (deal.sellerId) {
      const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      const session = sessionToken ? await verifySessionToken(sessionToken) : null;
      if (!session || session.sellerId !== deal.sellerId) {
        return NextResponse.json(
          { error: "Forbidden: You are not authorized to update shipment on this deal" },
          { status: 403 }
        );
      }
    }

    if (deal.status !== "FUNDS_HELD") {
      return NextResponse.json(
        { error: `Cannot add shipment in status '${deal.status}'. Expected 'FUNDS_HELD'.` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = shipBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid shipment data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { carrier, trackingNumber } = parsed.data;

    // Execute state transition: FUNDS_HELD -> SHIPPED
    const transitionResult = transition(deal.status as DealStatus, {
      dealId: deal.id,
      type: "SHIPMENT_ADDED",
      payload: { carrier, trackingNumber },
    });

    if (!transitionResult.ok) {
      return NextResponse.json({ error: transitionResult.error }, { status: 400 });
    }

    // Persist new status in DB
    await updateDealStatus(deal.id, transitionResult.newStatus);

    // Append to immutable audit log
    await appendDealEvent(deal.id, "SHIPMENT_ADDED", {
      carrier,
      trackingNumber,
      shippedAt: new Date().toISOString(),
    });

    let currentStatus = transitionResult.newStatus;
    let verificationEvidence = null;

    // Trigger FR-5: Real web verification via Kernel cloud browser
    try {
      const existingEvidence = await getEvidenceForDeal(deal.id);
      const evidenceId = `E${existingEvidence.length + 1}`;
      const kernelResult = await verifyTrackingWithKernel(trackingNumber, carrier);

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

      verificationEvidence = {
        id: evidenceId,
        status: kernelResult.status,
        screenshotUrl: kernelResult.screenshotUrl,
      };

      // If tracking reveals package has already been delivered, advance to DELIVERED
      if (kernelResult.status === "Delivered") {
        const delivTrans = transition(currentStatus, {
          dealId: deal.id,
          type: "DELIVERY_VERIFIED",
          payload: { trackingNumber, carrier, evidenceId },
        });
        if (delivTrans.ok) {
          currentStatus = delivTrans.newStatus;
          await updateDealStatus(deal.id, currentStatus);
          await appendDealEvent(deal.id, "DELIVERY_VERIFIED", {
            evidenceId,
            carrier,
            trackingNumber,
          });
        }
      }
    } catch (verifErr: any) {
      console.warn("Kernel verification notice:", verifErr.message);
    }

    return NextResponse.json({
      ok: true,
      dealStatus: currentStatus,
      carrier,
      trackingNumber,
      verification: verificationEvidence,
    });
  } catch (error: any) {
    console.error("Error adding shipment:", error.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to add shipment" },
      { status: 500 }
    );
  }
}

