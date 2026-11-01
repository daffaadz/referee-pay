import { describe, it, expect } from "vitest";
import { makeIdempotencyKey } from "./funds-hold";

describe("FundsHold Idempotency Key Generation", () => {
  it("generates deterministic keys under 38 characters for standard IDs", () => {
    const key1 = makeIdempotencyKey("deal-101", "create-order");
    const key2 = makeIdempotencyKey("deal-101", "create-order");

    expect(key1).toBe("deal-101-create-order");
    expect(key1).toBe(key2);
    expect(key1.length).toBeLessThanOrEqual(38);
    expect(/^[A-Za-z0-9_-]+$/.test(key1)).toBe(true);
  });

  it("hashes overly long keys to stay strictly <= 38 characters", () => {
    const veryLongDealId = "deal-super-long-uuid-that-exceeds-the-paypal-idempotency-key-limit-123456789";
    const key = makeIdempotencyKey(veryLongDealId, "capture");

    expect(key.length).toBeLessThanOrEqual(38);
    expect(key.startsWith("ref-")).toBe(true);
    expect(/^[A-Za-z0-9_-]+$/.test(key)).toBe(true);

    // Deterministic check
    const keyAgain = makeIdempotencyKey(veryLongDealId, "capture");
    expect(key).toBe(keyAgain);
  });

  it("sanitizes disallowed characters", () => {
    const key = makeIdempotencyKey("deal@123!", "auth");
    expect(/^[A-Za-z0-9_-]+$/.test(key)).toBe(true);
    expect(key).toBe("deal123-auth");
  });
});

