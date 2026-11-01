import { describe, it, expect, vi, beforeEach } from "vitest";
import { draftDeal } from "./drafter";

const { mockGenerateObject } = vi.hoisted(() => ({
  mockGenerateObject: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateObject: mockGenerateObject,
  };
});

describe("Drafter Agent", () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  it("drafts a valid DealContract with generated clauses from seller input", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        item: {
          title: "Handmade Leather Wallet",
          description: "Full grain vegetable tanned leather, brown color",
          price: {
            amount: "75.00",
            currency: "USD",
          },
        },
        seller: {
          displayName: "Sari",
          paypalEmail: "sari@example.com",
        },
        buyer: {
          displayName: "Maya",
        },
        terms: {
          shipDeadlineDays: 2,
          deliveryDeadlineDays: 10,
          inspectionWindowDays: 3,
          returnPolicy: {
            allowed: true,
            windowDays: 7,
            returnShippingPaidBy: "buyer" as const,
          },
        },
        defaultedFields: [],
      },
    });

    const result = await draftDeal({
      text: "Selling handmade leather wallet to Maya for $75. I will ship in 2 days, delivery in 10 days, 3 day inspection, 7 day return.",
    });

    expect(result.contract.item.title).toBe("Handmade Leather Wallet");
    expect(result.contract.item.price.amount).toBe("75.00");
    expect(result.contract.item.price.currency).toBe("USD");
    expect(result.contract.seller.displayName).toBe("Sari");
    expect(result.contract.terms.shipDeadlineDays).toBe(2);
    expect(result.contract.clauses.length).toBeGreaterThanOrEqual(4);
    expect(result.contract.clauses[0].id).toBe("C1");
  });

  it("applies defaults and flags defaultedFields when optional terms are omitted", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        item: {
          title: "Mechanical Keyboard",
          description: "Custom 65% keyboard",
          price: {
            amount: "120.00",
            currency: "USD",
          },
        },
        seller: {
          displayName: "Seller",
          paypalEmail: "seller@example.com",
        },
        buyer: {},
        terms: {
          shipDeadlineDays: 3,
          deliveryDeadlineDays: 14,
          inspectionWindowDays: 2,
          returnPolicy: {
            allowed: true,
            windowDays: 7,
            returnShippingPaidBy: "buyer" as const,
          },
        },
        defaultedFields: [
          "terms.shipDeadlineDays",
          "terms.deliveryDeadlineDays",
          "seller.paypalEmail",
        ],
      },
    });

    const result = await draftDeal({
      text: "Selling keyboard for $120.",
    });

    expect(result.contract.item.price.amount).toBe("120.00");
    expect(result.defaultedFields).toContain("terms.shipDeadlineDays");
    expect(result.contract.terms.shipDeadlineDays).toBe(3);
    expect(result.contract.terms.deliveryDeadlineDays).toBe(14);
  });

  it("handles no-return policy correctly with allowed: false and windowDays: 0", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        item: {
          title: "Sepeda Lipat",
          description: "Sepeda lipat",
          price: {
            amount: "80.00",
            currency: "USD",
          },
        },
        seller: {
          displayName: "Seller",
          paypalEmail: "seller@example.com",
        },
        buyer: {},
        terms: {
          shipDeadlineDays: 3,
          deliveryDeadlineDays: 10,
          inspectionWindowDays: 2,
          returnPolicy: {
            allowed: false,
            windowDays: 0,
            returnShippingPaidBy: "buyer" as const,
          },
        },
        defaultedFields: ["seller.displayName", "seller.paypalEmail"],
      },
    });

    const result = await draftDeal({
      text: "Jual sepeda lipat seharga 80 dolar. Diantar dalam waktu maksimal 10 hari. Tidak bisa return.",
    });

    expect(result.contract.terms.returnPolicy.allowed).toBe(false);
    expect(result.contract.terms.returnPolicy.windowDays).toBe(0);
    expect(result.contract.clauses.some((c) => c.text.includes("not allowed"))).toBe(true);
  });
});
