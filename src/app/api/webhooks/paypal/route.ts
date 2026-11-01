/**
 * PayPal Sandbox Webhook Handler.
 * Listens for asynchronous payment events such as CHECKOUT.ORDER.APPROVED.
 * Automatically authorizes the payment and places escrow funds on hold without
 * requiring manual buyer action.
 *
 * Verified against PayPal docs:
 * https://developer.paypal.com/api/rest/webhooks/
 * https://developer.paypal.com/docs/api/orders/v2/#orders_authorize
 *
 * Referenced requirements: FR-3, FR-9
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { getDealById, getPaymentByOrderId } from "@/db/queries";
import { processPaymentAuthorization } from "@/integrations/paypal/authorize-service";
import { getPayPalAccessToken } from "@/integrations/paypal/client";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let event: Record<string, any>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const eventType = event.event_type as string | undefined;
    if (!eventType) {
      return NextResponse.json({ error: "Missing event_type in payload" }, { status: 400 });
    }

    // 1. Signature Verification (if PAYPAL_WEBHOOK_ID is configured)
    const webhookId = env.PAYPAL_WEBHOOK_ID;
    const transmissionId = request.headers.get("paypal-transmission-id");
    const transmissionSig = request.headers.get("paypal-transmission-sig");
    const transmissionTime = request.headers.get("paypal-transmission-time");
    const certUrl = request.headers.get("paypal-cert-url");
    const authAlgo = request.headers.get("paypal-auth-algo");

    if (webhookId && transmissionId && transmissionSig && transmissionTime && certUrl && authAlgo) {
      try {
        const accessToken = await getPayPalAccessToken();
        const verifyRes = await fetch("https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            auth_algo: authAlgo,
            cert_url: certUrl,
            transmission_id: transmissionId,
            transmission_sig: transmissionSig,
            transmission_time: transmissionTime,
            webhook_id: webhookId,
            webhook_event: event,
          }),
        });

        if (verifyRes.ok) {
          const verifyData = (await verifyRes.json()) as { verification_status?: string };
          if (verifyData.verification_status !== "SUCCESS") {
            console.warn("PayPal webhook signature verification failed:", verifyData);
            return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
          }
        } else {
          const errText = await verifyRes.text();
          console.warn(`PayPal webhook verification returned status ${verifyRes.status}: ${errText}`);
        }
      } catch (verifyErr: any) {
        console.warn("Error calling PayPal webhook verification endpoint:", verifyErr.message);
      }
    }

    // 2. Process CHECKOUT.ORDER.APPROVED event
    if (eventType === "CHECKOUT.ORDER.APPROVED") {
      const orderId = event.resource?.id as string | undefined;
      let dealId = event.resource?.purchase_units?.[0]?.custom_id as string | undefined;

      // Fallback: look up dealId via orderId in payments table
      if (!dealId && orderId) {
        const paymentRow = await getPaymentByOrderId(orderId);
        if (paymentRow) {
          dealId = paymentRow.dealId;
        }
      }

      if (!dealId || !orderId) {
        console.warn(`PayPal Webhook: Unable to associate order '${orderId}' with a deal.`);
        return NextResponse.json(
          { ok: true, message: "Order not associated with an active deal", event: eventType },
          { status: 200 }
        );
      }

      const deal = await getDealById(dealId);
      if (!deal) {
        return NextResponse.json(
          { ok: true, message: `Deal '${dealId}' not found`, event: eventType },
          { status: 200 }
        );
      }

      const result = await processPaymentAuthorization(deal.id, orderId);
      return NextResponse.json({
        ok: true,
        event: eventType,
        dealId,
        orderId,
        result,
      });
    }

    // Acknowledge other event types (PAYMENT.AUTHORIZATION.CREATED, PAYMENT.CAPTURE.COMPLETED, etc.)
    return NextResponse.json({ ok: true, event: eventType, acknowledged: true });
  } catch (error: any) {
    console.error("PayPal webhook error:", error.message || error);
    return NextResponse.json(
      { error: error.message || "Failed to process webhook" },
      { status: 500 }
    );
  }
}
