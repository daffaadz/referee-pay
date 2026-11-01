import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  STATE_COOKIE_NAME,
} from "@/domain/session";
import { GET as callbackRoute } from "@/app/api/auth/paypal/callback/route";
import { GET as demoGetRoute, POST as demoPostRoute } from "@/app/api/auth/demo/route";
import { GET as meRoute } from "@/app/api/seller/me/route";
import { POST as createDealRoute } from "@/app/api/deals/route";
import { POST as shipRoute } from "@/app/api/deals/[token]/ship/route";
import * as queries from "@/db/queries";
import * as events from "@/db/events";
import * as kernelClient from "@/integrations/kernel/client";

describe("Seller Authentication & Isolation (FR-13)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  describe("Session Token Security", () => {
    it("creates and verifies a valid signed session token", async () => {
      const payload = {
        sellerId: "seller_alice_123",
        email: "alice@example.com",
        name: "Alice Seller",
      };

      const token = await createSessionToken(payload);
      expect(typeof token).toBe("string");

      const verified = await verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.sellerId).toBe("seller_alice_123");
      expect(verified?.email).toBe("alice@example.com");
      expect(verified?.name).toBe("Alice Seller");
    });

    it("rejects forged and tampered session tokens", async () => {
      const forgedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tampered_signature";
      const verified = await verifySessionToken(forgedToken);
      expect(verified).toBeNull();
    });

    it("rejects garbage string as token", async () => {
      const verified = await verifySessionToken("not-a-token-at-all");
      expect(verified).toBeNull();
    });
  });

  describe("OAuth Callback State CSRF Protection", () => {
    it("rejects callback request when state parameter does not match cookie", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/paypal/callback?code=mock_code&state=attack_state");
      req.cookies.set(STATE_COOKIE_NAME, "legitimate_state");

      const res = await callbackRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid state parameter");
    });

    it("rejects callback request when state cookie is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/paypal/callback?code=mock_code&state=some_state");
      // No state cookie set

      const res = await callbackRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid state parameter");
    });

    it("rejects callback when code or state is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/paypal/callback?code=mock_code");
      const res = await callbackRoute(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DEMO_MODE Sign In Guardrails", () => {
    it("refuses demo sign in when DEMO_MODE is not true", async () => {
      process.env.DEMO_MODE = "false";

      const reqGet = new NextRequest("http://localhost:3000/api/auth/demo");
      const resGet = await demoGetRoute(reqGet);
      expect(resGet.status).toBe(403);
      const dataGet = await resGet.json();
      expect(dataGet.error).toContain("disabled in non-demo mode");

      const resPost = await demoPostRoute();
      expect(resPost.status).toBe(403);
    });

    it("allows demo sign in when DEMO_MODE is true", async () => {
      process.env.DEMO_MODE = "true";
      vi.spyOn(queries, "upsertSeller").mockResolvedValue({
        id: "seller_demo_1",
        paypalSub: "demo_seller_sub_12345",
        email: "sari.demo@example.com",
        name: "Sari (Demo Seller)",
        emailVerified: true,
        createdAt: new Date(),
      });

      const reqGet = new NextRequest("http://localhost:3000/api/auth/demo?redirect=/dashboard");
      const resGet = await demoGetRoute(reqGet);
      expect(resGet.status).toBe(307); // Redirect to /dashboard
      expect(resGet.headers.get("location")).toContain("/dashboard");
      expect(resGet.cookies.get(SESSION_COOKIE_NAME)).toBeDefined();

      const resPost = await demoPostRoute();
      expect(resPost.status).toBe(200);
      const dataPost = await resPost.json();
      expect(dataPost.ok).toBe(true);
      expect(dataPost.seller.email).toBe("sari.demo@example.com");
    });
  });

  describe("Seller Me Endpoint", () => {
    it("returns unauthenticated when session cookie is absent", async () => {
      const req = new NextRequest("http://localhost:3000/api/seller/me");
      const res = await meRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(false);
      expect(data.seller).toBeNull();
    });

    it("returns seller profile when valid session cookie is present", async () => {
      const sessionToken = await createSessionToken({
        sellerId: "seller_bob_456",
        email: "bob@example.com",
        name: "Bob Seller",
      });

      vi.spyOn(queries, "getSellerById").mockResolvedValue({
        id: "seller_bob_456",
        paypalSub: "sub_bob",
        email: "bob@example.com",
        emailVerified: true,
        name: "Bob Seller",
        createdAt: new Date(),
      });

      const req = new NextRequest("http://localhost:3000/api/seller/me");
      req.cookies.set(SESSION_COOKIE_NAME, sessionToken);

      const res = await meRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
      expect(data.seller.id).toBe("seller_bob_456");
      expect(data.seller.email).toBe("bob@example.com");
    });
  });

  describe("Deal Creation Authentication & Ownership", () => {
    it("POST /api/deals rejects unauthenticated requests with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/deals", {
        method: "POST",
        body: JSON.stringify({
          item: { title: "Tote Bag", description: "Leather", price: { amount: "50.00", currency: "USD" } },
          seller: { displayName: "Spoofer", paypalEmail: "spoofed@example.com" },
          terms: { shipDeadlineDays: 2, deliveryDeadlineDays: 7, inspectionWindowDays: 1, returnPolicy: { allowed: false, windowDays: 0, returnShippingPaidBy: "buyer" }, autoReleaseAfterInspection: true },
        }),
      });

      const res = await createDealRoute(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Authentication required");
    });

    it("POST /api/deals locks payout destination to verified session email", async () => {
      const sessionToken = await createSessionToken({
        sellerId: "seller_charlie_789",
        email: "charlie.verified@paypal.example.com",
        name: "Charlie",
      });

      let capturedDealInput: any = null;
      vi.spyOn(queries, "createDeal").mockImplementation(async (input) => {
        capturedDealInput = input;
        return { id: "deal_charlie_123" } as any;
      });
      vi.spyOn(queries, "updateDealStatus").mockResolvedValue({} as any);
      vi.spyOn(events, "appendDealEvent").mockResolvedValue({} as any);

      // Client attempts to pass a different email in payload
      const req = new NextRequest("http://localhost:3000/api/deals", {
        method: "POST",
        body: JSON.stringify({
          item: { title: "Handmade Cup", description: "Ceramic", price: { amount: "30.00", currency: "USD" } },
          seller: { displayName: "Charlie", paypalEmail: "attacker.destination@bad.com" },
          terms: { shipDeadlineDays: 3, deliveryDeadlineDays: 10, inspectionWindowDays: 2, returnPolicy: { allowed: true, windowDays: 7, returnShippingPaidBy: "buyer" }, autoReleaseAfterInspection: true },
        }),
      });
      req.cookies.set(SESSION_COOKIE_NAME, sessionToken);

      const res = await createDealRoute(req);
      expect(res.status).toBe(200);

      // Verify that server enforced session email and sellerId, overriding the attacker's email
      expect(capturedDealInput).not.toBeNull();
      expect(capturedDealInput.sellerId).toBe("seller_charlie_789");
      expect(capturedDealInput.contract.seller.paypalEmail).toBe("charlie.verified@paypal.example.com");
    });
  });

  describe("Seller A vs Seller B Isolation on Deal Actions", () => {
    it("prevents Seller B from adding tracking to Seller A deal", async () => {
      // Mock deal owned by Seller A
      vi.spyOn(queries, "getDealByToken").mockResolvedValue({
        deal: {
          id: "deal_owner_A",
          sellerId: "seller_A_uuid",
          status: "FUNDS_HELD",
        } as any,
        role: "seller",
      });

      // Seller B requests update with Seller B session
      const sellerBSession = await createSessionToken({
        sellerId: "seller_B_uuid",
        email: "sellerB@example.com",
      });

      const req = new NextRequest("http://localhost:3000/api/deals/token_123/ship", {
        method: "POST",
        body: JSON.stringify({ carrier: "Mock Carrier", trackingNumber: "TRK-B-ILLEGAL" }),
      });
      req.cookies.set(SESSION_COOKIE_NAME, sellerBSession);

      const res = await shipRoute(req, { params: Promise.resolve({ token: "token_123" }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Forbidden");
    });

    it("allows Seller A to add tracking to Seller A deal", async () => {
      vi.spyOn(queries, "getDealByToken").mockResolvedValue({
        deal: {
          id: "deal_owner_A",
          sellerId: "seller_A_uuid",
          status: "FUNDS_HELD",
        } as any,
        role: "seller",
      });
      vi.spyOn(queries, "updateDealStatus").mockResolvedValue({} as any);
      vi.spyOn(events, "appendDealEvent").mockResolvedValue({} as any);
      vi.spyOn(queries, "getEvidenceForDeal").mockResolvedValue([]);
      vi.spyOn(queries, "addEvidence").mockResolvedValue({} as any);
      vi.spyOn(kernelClient, "verifyTrackingWithKernel").mockResolvedValue({
        carrier: "Mock Carrier",
        trackingNumber: "TRK-A-LEGIT",
        status: "In transit",
        statusText: "In Transit",
        contentHash: "hash_test_123",
        verifiedAt: new Date(),
        screenshotUrl: "https://example.com/screenshot.png",
      });

      // Seller A session
      const sellerASession = await createSessionToken({
        sellerId: "seller_A_uuid",
        email: "sellerA@example.com",
      });

      const req = new NextRequest("http://localhost:3000/api/deals/token_123/ship", {
        method: "POST",
        body: JSON.stringify({ carrier: "Mock Carrier", trackingNumber: "TRK-A-LEGIT" }),
      });
      req.cookies.set(SESSION_COOKIE_NAME, sellerASession);

      const res = await shipRoute(req, { params: Promise.resolve({ token: "token_123" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });
});
