import { describe, it, expect } from "vitest";
import { dealContractSchema, generateDefaultClauses } from "./contract";
import { Money } from "./money";

describe("DealContract Schema & Helpers", () => {
  it("validates a complete, valid DealContract", () => {
    const validContract = {
      item: {
        title: "Vintage Leather Jacket",
        description: "Brown genuine leather jacket in excellent condition, size M.",
        price: { amount: "120.00", currency: "USD" },
      },
      seller: {
        displayName: "Sari",
        paypalEmail: "sari-seller@example.com",
      },
      buyer: {
        displayName: "Maya",
        paypalEmail: "maya-buyer@example.com",
      },
      terms: {
        shipDeadlineDays: 3,
        deliveryDeadlineDays: 14,
        inspectionWindowDays: 2,
        returnPolicy: {
          allowed: true,
          windowDays: 7,
          returnShippingPaidBy: "buyer" as const,
        },
        autoReleaseAfterInspection: true as const,
      },
      clauses: [
        { id: "C1", text: "Buyer funds the escrow." },
        { id: "C2", text: "Seller ships with tracking within 3 days." },
      ],
    };

    const parsed = dealContractSchema.safeParse(validContract);
    expect(parsed.success).toBe(true);
  });

  it("fails on invalid money format in contract", () => {
    const invalidContract = {
      item: {
        title: "Vintage Leather Jacket",
        description: "Description",
        price: { amount: "-100", currency: "USD" },
      },
      seller: {
        displayName: "Sari",
        paypalEmail: "sari@example.com",
      },
      terms: {
        shipDeadlineDays: 3,
        deliveryDeadlineDays: 14,
        inspectionWindowDays: 2,
        returnPolicy: { allowed: true, windowDays: 7, returnShippingPaidBy: "buyer" },
        autoReleaseAfterInspection: true,
      },
      clauses: [{ id: "C1", text: "Text" }],
    };

    const parsed = dealContractSchema.safeParse(invalidContract);
    expect(parsed.success).toBe(false);
  });

  it("generates default numbered clauses correctly", () => {
    const terms = {
      shipDeadlineDays: 3,
      deliveryDeadlineDays: 10,
      inspectionWindowDays: 2,
      returnPolicy: {
        allowed: true,
        windowDays: 7,
        returnShippingPaidBy: "buyer" as const,
      },
      autoReleaseAfterInspection: true as const,
    };
    const price = Money.create("80.00", "USD");

    const clauses = generateDefaultClauses(terms, price);
    expect(clauses.length).toBe(5);
    expect(clauses[0].id).toBe("C1");
    expect(clauses[0].text).toContain("80.00 USD");
    expect(clauses[1].id).toBe("C2");
    expect(clauses[1].text).toContain("3 days");
  });
});

