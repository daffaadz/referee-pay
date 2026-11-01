import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as webhookRoute } from "./route";
import * as queries from "@/db/queries";
import * as events from "@/db/events";
import { fundsHold } from "@/integrations/paypal/funds-hold";

describe("PayPal Webhook Handler (FR-3, FR-9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid JSON payload", async () => {
    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      body: "not-json",
    });

    const res = await webhookRoute(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 when event_type is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      body: JSON.stringify({ resource: {} }),
    });

    const res = await webhookRoute(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing event_type");
  });

  it("handles CHECKOUT.ORDER.APPROVED and automatically authorizes funds into escrow hold", async () => {
    const mockDeal = {
      id: "deal-webhook-1",
      status: "AWAITING_PAYMENT",
      amount: "50.00",
      currency: "USD",
    } as any;

    vi.spyOn(queries, "getDealById").mockResolvedValue(mockDeal);
    vi.spyOn(fundsHold, "authorizeOrder").mockResolvedValue({
      authorizationId: "AUTH-WEBHOOK-123",
      status: "CREATED",
      amount: { amount: "50.00", currency: "USD" },
    });
    const recordPaymentSpy = vi.spyOn(queries, "recordPayment").mockResolvedValue({} as any);
    const updateDealStatusSpy = vi.spyOn(queries, "updateDealStatus").mockResolvedValue({} as any);
    const appendDealEventSpy = vi.spyOn(events, "appendDealEvent").mockResolvedValue({} as any);

    const webhookPayload = {
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: {
        id: "ORDER-WEBHOOK-999",
        purchase_units: [
          {
            custom_id: "deal-webhook-1",
          },
        ],
      },
    };

    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      body: JSON.stringify(webhookPayload),
    });

    const res = await webhookRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.event).toBe("CHECKOUT.ORDER.APPROVED");
    expect(body.result.dealStatus).toBe("FUNDS_HELD");
    expect(body.result.authorizationId).toBe("AUTH-WEBHOOK-123");

    expect(updateDealStatusSpy).toHaveBeenCalledWith("deal-webhook-1", "FUNDS_HELD");
    expect(recordPaymentSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: "deal-webhook-1",
        orderId: "ORDER-WEBHOOK-999",
        authorizationId: "AUTH-WEBHOOK-123",
      })
    );
    expect(appendDealEventSpy).toHaveBeenCalledWith(
      "deal-webhook-1",
      "PAYMENT_AUTHORIZED",
      expect.objectContaining({
        orderId: "ORDER-WEBHOOK-999",
        authorizationId: "AUTH-WEBHOOK-123",
      })
    );
  });

  it("is idempotent if deal has already been transitioned to FUNDS_HELD", async () => {
    const mockDeal = {
      id: "deal-webhook-already-held",
      status: "FUNDS_HELD",
      amount: "50.00",
      currency: "USD",
    } as any;

    vi.spyOn(queries, "getDealById").mockResolvedValue(mockDeal);
    const authorizeSpy = vi.spyOn(fundsHold, "authorizeOrder");

    const webhookPayload = {
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: {
        id: "ORDER-WEBHOOK-999",
        purchase_units: [
          {
            custom_id: "deal-webhook-already-held",
          },
        ],
      },
    };

    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      body: JSON.stringify(webhookPayload),
    });

    const res = await webhookRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result.alreadyProcessed).toBe(true);
    expect(authorizeSpy).not.toHaveBeenCalled();
  });

  it("resolves deal via payment orderId fallback when custom_id is not in webhook resource", async () => {
    const mockPayment = {
      id: "pay-1",
      dealId: "deal-fallback-id",
      orderId: "ORDER-FALLBACK-777",
    } as any;

    const mockDeal = {
      id: "deal-fallback-id",
      status: "AWAITING_PAYMENT",
      amount: "25.00",
      currency: "USD",
    } as any;

    vi.spyOn(queries, "getPaymentByOrderId").mockResolvedValue(mockPayment);
    vi.spyOn(queries, "getDealById").mockResolvedValue(mockDeal);
    vi.spyOn(fundsHold, "authorizeOrder").mockResolvedValue({
      authorizationId: "AUTH-FALLBACK-777",
      status: "CREATED",
      amount: { amount: "25.00", currency: "USD" },
    });
    vi.spyOn(queries, "recordPayment").mockResolvedValue({} as any);
    vi.spyOn(queries, "updateDealStatus").mockResolvedValue({} as any);
    vi.spyOn(events, "appendDealEvent").mockResolvedValue({} as any);

    const webhookPayload = {
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: {
        id: "ORDER-FALLBACK-777",
      },
    };

    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      body: JSON.stringify(webhookPayload),
    });

    const res = await webhookRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.dealId).toBe("deal-fallback-id");
    expect(body.result.dealStatus).toBe("FUNDS_HELD");
  });
});
