import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import * as queries from "@/db/queries";
import * as events from "@/db/events";
import { fundsHold } from "@/integrations/paypal/funds-hold";
import { POST as createOrderRoute } from "./create-order/route";
import { POST as authorizeRoute } from "./authorize/route";

describe("PayPal Route Handlers (FR-3)", () => {
  it("create-order returns 404 for invalid capability token", async () => {
    vi.spyOn(queries, "getDealByToken").mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/deals/invalid/paypal/create-order", {
      method: "POST",
    });

    const res = await createOrderRoute(req, { params: Promise.resolve({ token: "invalid" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Deal not found");
  });

  it("create-order returns 400 if deal is not in AWAITING_PAYMENT", async () => {
    vi.spyOn(queries, "getDealByToken").mockResolvedValue({
      deal: {
        id: "deal-1",
        status: "FUNDS_HELD",
        contractJson: {
          item: { price: { amount: "100.00", currency: "USD" } },
        },
      } as any,
      role: "buyer",
    });

    const req = new NextRequest("http://localhost:3000/api/deals/token123/paypal/create-order", {
      method: "POST",
    });

    const res = await createOrderRoute(req, { params: Promise.resolve({ token: "token123" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Expected 'AWAITING_PAYMENT'");
  });

  it("create-order creates order with exact contract amount and records payment", async () => {
    vi.spyOn(queries, "getDealByToken").mockResolvedValue({
      deal: {
        id: "deal-2",
        status: "AWAITING_PAYMENT",
        contractJson: {
          item: { price: { amount: "85.00", currency: "USD" } },
        },
      } as any,
      role: "buyer",
    });

    const createOrderSpy = vi.spyOn(fundsHold, "createOrder").mockResolvedValue({
      orderId: "ORDER-12345",
      approveUrl: "https://sandbox.paypal.com/checkoutnow?token=ORDER-12345",
      status: "CREATED",
    });

    const recordPaymentSpy = vi.spyOn(queries, "recordPayment").mockResolvedValue({} as any);

    const req = new NextRequest("http://localhost:3000/api/deals/token123/paypal/create-order", {
      method: "POST",
    });

    const res = await createOrderRoute(req, { params: Promise.resolve({ token: "token123" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.orderId).toBe("ORDER-12345");
    expect(createOrderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: "deal-2",
        amount: { amount: "85.00", currency: "USD" },
        customId: "deal-2",
      })
    );
    expect(recordPaymentSpy).toHaveBeenCalled();
  });

  it("authorize returns 400 when orderId is missing and not in payment record", async () => {
    vi.spyOn(queries, "getDealByToken").mockResolvedValue({
      deal: {
        id: "deal-3",
        status: "AWAITING_PAYMENT",
      } as any,
      role: "buyer",
    });
    vi.spyOn(queries, "getPaymentByDealId").mockResolvedValue(null as any);

    const req = new NextRequest("http://localhost:3000/api/deals/token123/paypal/authorize", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await authorizeRoute(req, { params: Promise.resolve({ token: "token123" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No PayPal order found");
  });

  it("authorize transitions deal to FUNDS_HELD and records authorization", async () => {
    const mockDeal = {
      id: "deal-4",
      status: "AWAITING_PAYMENT",
      amount: "100.00",
      currency: "USD",
    } as any;

    vi.spyOn(queries, "getDealByToken").mockResolvedValue({
      deal: mockDeal,
      role: "buyer",
    });
    vi.spyOn(queries, "getDealById").mockResolvedValue(mockDeal);

    vi.spyOn(fundsHold, "authorizeOrder").mockResolvedValue({
      authorizationId: "AUTH-99999",
      status: "CREATED",
    });

    const updateStatusSpy = vi.spyOn(queries, "updateDealStatus").mockResolvedValue({} as any);
    const recordPaymentSpy = vi.spyOn(queries, "recordPayment").mockResolvedValue({} as any);
    const appendEventSpy = vi.spyOn(events, "appendDealEvent").mockResolvedValue({} as any);

    const req = new NextRequest("http://localhost:3000/api/deals/token123/paypal/authorize", {
      method: "POST",
      body: JSON.stringify({ orderId: "ORDER-12345" }),
    });

    const res = await authorizeRoute(req, { params: Promise.resolve({ token: "token123" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.dealStatus).toBe("FUNDS_HELD");
    expect(body.authorizationId).toBe("AUTH-99999");
    expect(updateStatusSpy).toHaveBeenCalledWith("deal-4", "FUNDS_HELD");
    expect(recordPaymentSpy).toHaveBeenCalled();
  });
});
