import { describe, it, expect } from "vitest";
import { Money, moneySchema } from "./money";

describe("Money Helper", () => {
  it("creates valid money with normalized 2 decimal places", () => {
    const m1 = Money.create("100", "USD");
    expect(m1).toEqual({ amount: "100.00", currency: "USD" });

    const m2 = Money.create("49.9", "USD");
    expect(m2).toEqual({ amount: "49.90", currency: "USD" });

    const m3 = Money.create(75.5, "eur");
    expect(m3).toEqual({ amount: "75.50", currency: "EUR" });
  });

  it("throws on invalid money format", () => {
    expect(() => Money.create("invalid")).toThrow(/Invalid money amount format/);
    expect(() => Money.create("-10.00")).toThrow(/Invalid money amount format/);
    expect(() => Money.create("10.999")).toThrow(/Invalid money amount format/);
    expect(() => Money.create("10", "US")).toThrow(/Invalid currency code/);
  });

  it("adds money values accurately without floating point errors", () => {
    const a = Money.create("0.10", "USD");
    const b = Money.create("0.20", "USD");
    const sum = Money.add(a, b);
    expect(sum).toEqual({ amount: "0.30", currency: "USD" });
  });

  it("throws on adding different currencies", () => {
    const a = Money.create("10.00", "USD");
    const b = Money.create("10.00", "EUR");
    expect(() => Money.add(a, b)).toThrow(/Currency mismatch/);
  });

  it("subtracts money values and prevents negative amounts", () => {
    const a = Money.create("50.00", "USD");
    const b = Money.create("20.25", "USD");
    const diff = Money.subtract(a, b);
    expect(diff).toEqual({ amount: "29.75", currency: "USD" });

    expect(() => Money.subtract(b, a)).toThrow(/negative money/);
  });

  it("calculates percentages with round-to-nearest-cent", () => {
    const total = Money.create("100.00", "USD");
    const share60 = Money.percent(total, 60);
    expect(share60).toEqual({ amount: "60.00", currency: "USD" });

    const odd = Money.create("33.33", "USD");
    const half = Money.percent(odd, 50);
    expect(half).toEqual({ amount: "16.67", currency: "USD" });
  });

  it("compares money values correctly", () => {
    const a = Money.create("100.00", "USD");
    const b = Money.create("200.00", "USD");
    const c = Money.create("100.00", "USD");

    expect(Money.compare(a, b)).toBe(-1);
    expect(Money.compare(b, a)).toBe(1);
    expect(Money.compare(a, c)).toBe(0);

    expect(Money.isLessThan(a, b)).toBe(true);
    expect(Money.isGreaterThan(b, a)).toBe(true);
    expect(Money.isEqual(a, c)).toBe(true);
  });

  it("validates using Zod moneySchema", () => {
    const valid = moneySchema.safeParse({ amount: "150.00", currency: "USD" });
    expect(valid.success).toBe(true);

    const invalid = moneySchema.safeParse({ amount: "abc", currency: "USD" });
    expect(invalid.success).toBe(false);
  });
});

