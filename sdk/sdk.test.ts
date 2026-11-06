import { describe, it, expect, vi, beforeEach } from "vitest";
import { RefereeClient } from "./index";

describe("RefereeClient SDK", () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("initializes with default options", () => {
    const client = new RefereeClient();
    expect(client).toBeDefined();
  });

  it("calls getDeal with correct URL and capability token header", async () => {
    const client = new RefereeClient({
      baseUrl: "https://referee-pay.vercel.app/api",
      capabilityToken: "cap-token-123",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        role: "buyer",
        deal: { id: "deal-1", title: "Test Deal", status: "FUNDS_HELD", amount: "100.00", currency: "USD" },
        events: [],
        evidence: [],
        decisions: [],
      }),
    });

    const res = await client.getDeal("cap-token-123");
    expect(res.ok).toBe(true);
    expect(res.deal.id).toBe("deal-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://referee-pay.vercel.app/api/deals/cap-token-123",
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      })
    );
  });

  it("handles API error responses cleanly", async () => {
    const client = new RefereeClient({ baseUrl: "http://127.0.0.1:3000/api" });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Deal not found" }),
    });

    await expect(client.getDeal("nonexistent")).rejects.toThrow("Deal not found");
  });
});

