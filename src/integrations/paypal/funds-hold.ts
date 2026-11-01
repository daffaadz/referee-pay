import crypto from "crypto";
import { CheckoutPaymentIntent } from "@paypal/paypal-server-sdk";
import { ordersController, paymentsController, getPayPalAccessToken } from "./client";
import type { Money } from "../../domain/money";

export interface CreateOrderParams {
  dealId: string;
  amount: Money;
  customId: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface CreateOrderResult {
  orderId: string;
  approveUrl?: string;
  status?: string;
}

export interface AuthorizeOrderParams {
  dealId: string;
  orderId: string;
}

export interface AuthorizeOrderResult {
  authorizationId: string;
  status: string;
  amount?: Money;
}

export interface ReleaseParams {
  dealId: string;
  authorizationId: string;
  amount: Money;
  sellerPaypalEmail: string;
  finalCapture?: boolean;
}

export interface ReleaseResult {
  captureId: string;
  payoutBatchId?: string;
  payoutStatus?: string;
  status: string;
}

export interface RefundParams {
  dealId: string;
  authorizationId: string;
  note?: string;
}

export interface RefundResult {
  voidStatus: string;
  statusCode?: number;
}

/**
 * Standard FundsHold interface per requirements.md 9.2.
 * Allows swapping between Strategy A (Authorize & Capture later)
 * and Strategy B (Capture immediately & Hold in platform balance).
 */
export interface FundsHold {
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  authorizeOrder(params: AuthorizeOrderParams): Promise<AuthorizeOrderResult>;
  release(params: ReleaseParams): Promise<ReleaseResult>;
  refund(params: RefundParams): Promise<RefundResult>;
}

/**
 * Derives a strictly compliant idempotency key (PayPal-Request-Id) <= 38 characters.
 * AGENTS.md 3.3: Every PayPal write uses an idempotency key derived from dealId + action.
 */
export function makeIdempotencyKey(dealId: string, action: string): string {
  const sanitized = `${dealId}-${action}`.replace(/[^A-Za-z0-9_-]/g, "");
  if (sanitized.length <= 38) {
    return sanitized;
  }
  const hash = crypto.createHash("sha256").update(`${dealId}:${action}`).digest("hex");
  return `ref-${hash.slice(0, 32)}`;
}

/**
 * Strategy A implementation: Authorize now, capture later.
 * Verified against PayPal docs:
 * - https://developer.paypal.com/checkout/delay-capture
 * - https://developer.paypal.com/payment-methods/auth-honor
 * - https://developer.paypal.com/checkout/void-authorized-payment
 * - https://developer.paypal.com/api/payouts
 */
export class PaypalStrategyAFundsHold implements FundsHold {
  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const requestId = makeIdempotencyKey(params.dealId, "create-order");

    const response = await ordersController.createOrder({
      paypalRequestId: requestId,
      body: {
        intent: CheckoutPaymentIntent.Authorize,
        purchaseUnits: [
          {
            amount: {
              currencyCode: params.amount.currency,
              value: params.amount.amount,
            },
            customId: params.customId,
            description: `Referee Escrow Deal: ${params.dealId}`,
          },
        ],
      },
    });

    const order = response.result;
    const approveLink = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;

    if (!order.id) {
      throw new Error(`Failed to create PayPal order: ${JSON.stringify(order)}`);
    }

    return {
      orderId: order.id,
      approveUrl: approveLink,
      status: order.status,
    };
  }

  async authorizeOrder(params: AuthorizeOrderParams): Promise<AuthorizeOrderResult> {
    const requestId = makeIdempotencyKey(params.dealId, "authorize");

    const response = await ordersController.authorizeOrder({
      id: params.orderId,
      paypalRequestId: requestId,
    });

    const result = response.result;
    const auth = result.purchaseUnits?.[0]?.payments?.authorizations?.[0];

    if (!auth?.id) {
      throw new Error(`No authorization ID returned for order ${params.orderId}: ${JSON.stringify(result)}`);
    }

    return {
      authorizationId: auth.id,
      status: auth.status || "CREATED",
      amount:
        auth.amount?.value && auth.amount?.currencyCode
          ? { amount: auth.amount.value, currency: auth.amount.currencyCode }
          : undefined,
    };
  }

  async release(params: ReleaseParams): Promise<ReleaseResult> {
    const captureRequestId = makeIdempotencyKey(params.dealId, "capture");

    // Step 1: Capture the authorization with final_capture: true
    const captureResponse = await paymentsController.captureAuthorizedPayment({
      authorizationId: params.authorizationId,
      paypalRequestId: captureRequestId,
      body: {
        amount: {
          currencyCode: params.amount.currency,
          value: params.amount.amount,
        },
        finalCapture: params.finalCapture ?? true,
      },
    });

    const capture = captureResponse.result;
    const captureId = capture.id;
    if (!captureId) {
      throw new Error(`Capture failed for authorization ${params.authorizationId}: ${JSON.stringify(capture)}`);
    }

    // Step 2: Payout to seller via PayPal Payouts v1 API
    let payoutBatchId: string | undefined;
    let payoutStatus: string | undefined;

    try {
      const accessToken = await getPayPalAccessToken();
      const payoutRequestId = makeIdempotencyKey(params.dealId, "payout");

      const payoutRes = await fetch("https://api-m.sandbox.paypal.com/v1/payments/payouts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": payoutRequestId,
        },
        body: JSON.stringify({
          sender_batch_header: {
            sender_batch_id: payoutRequestId,
            email_subject: "Referee Deal Escrow Release",
          },
          items: [
            {
              recipient_type: "EMAIL",
              amount: {
                value: params.amount.amount,
                currency: params.amount.currency,
              },
              receiver: params.sellerPaypalEmail,
              note: `Referee release for deal ${params.dealId}`,
              sender_item_id: `${params.dealId}-payout-item`,
            },
          ],
        }),
      });

      if (payoutRes.ok) {
        const payoutData = (await payoutRes.json()) as {
          batch_header?: { payout_batch_id?: string; batch_status?: string };
        };
        payoutBatchId = payoutData.batch_header?.payout_batch_id;
        payoutStatus = payoutData.batch_header?.batch_status;
      } else {
        const errText = await payoutRes.text();
        console.warn(`Payout API returned non-200 (${payoutRes.status}): ${errText}`);
        payoutStatus = `ERROR_${payoutRes.status}`;
      }
    } catch (payoutErr: any) {
      console.warn("Payout warning (captured funds held in platform balance):", payoutErr.message);
      payoutStatus = "FAILED_EXCEPTION";
    }

    return {
      captureId,
      payoutBatchId,
      payoutStatus,
      status: capture.status || "COMPLETED",
    };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const voidRequestId = makeIdempotencyKey(params.dealId, "void");

    const response = await paymentsController.voidPayment({
      authorizationId: params.authorizationId,
      paypalRequestId: voidRequestId,
    });

    return {
      voidStatus: "VOIDED",
      statusCode: response.statusCode || 204,
    };
  }
}

export const fundsHold: FundsHold = new PaypalStrategyAFundsHold();

