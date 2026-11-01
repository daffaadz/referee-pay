import { z } from "zod";

/**
 * Money representation per AGENTS.md 3.3 and requirements.md 5.1:
 * Decimal-string amount with explicit 3-letter currency code.
 * Never uses floating-point representation for money amounts.
 */
export interface Money {
  amount: string; // e.g. "100.00"
  currency: string; // e.g. "USD"
}

export const moneySchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid non-negative decimal string with up to 2 decimal places"),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code"),
});

/**
 * Converts a decimal string to integer cents (e.g. "10.50" -> 1050)
 */
function toCents(amount: string): bigint {
  const parts = amount.split(".");
  const whole = BigInt(parts[0] || "0");
  const fractionalStr = (parts[1] || "").padEnd(2, "0").slice(0, 2);
  const frac = BigInt(fractionalStr);
  return whole * 100n + frac;
}

/**
 * Converts integer cents back to normalized decimal string (e.g. 1050n -> "10.50")
 */
function fromCents(cents: bigint): string {
  if (cents < 0n) {
    throw new Error(`Negative money amount is not allowed: ${cents}`);
  }
  const whole = cents / 100n;
  const frac = cents % 100n;
  return `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}

export const Money = {
  /**
   * Creates and validates a Money object with normalized 2 decimal places.
   */
  create(amount: string | number, currency = "USD"): Money {
    const rawStr = typeof amount === "number" ? amount.toFixed(2) : amount.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(rawStr)) {
      throw new Error(`Invalid money amount format: "${amount}"`);
    }
    const cents = toCents(rawStr);
    const upperCurrency = currency.toUpperCase();
    if (!/^[A-Z]{3}$/.test(upperCurrency)) {
      throw new Error(`Invalid currency code: "${currency}"`);
    }

    return {
      amount: fromCents(cents),
      currency: upperCurrency,
    };
  },

  /**
   * Adds two Money values of the same currency.
   */
  add(a: Money, b: Money): Money {
    if (a.currency !== b.currency) {
      throw new Error(`Currency mismatch in add: ${a.currency} vs ${b.currency}`);
    }
    const resultCents = toCents(a.amount) + toCents(b.amount);
    return {
      amount: fromCents(resultCents),
      currency: a.currency,
    };
  },

  /**
   * Subtracts Money b from Money a. Throws if result would be negative.
   */
  subtract(a: Money, b: Money): Money {
    if (a.currency !== b.currency) {
      throw new Error(`Currency mismatch in subtract: ${a.currency} vs ${b.currency}`);
    }
    const aCents = toCents(a.amount);
    const bCents = toCents(b.amount);
    if (aCents < bCents) {
      throw new Error(`Subtraction results in negative money: ${a.amount} - ${b.amount}`);
    }
    return {
      amount: fromCents(aCents - bCents),
      currency: a.currency,
    };
  },

  /**
   * Multiplies Money by a percentage (0..100) and rounds to nearest cent.
   */
  percent(m: Money, percent: number): Money {
    if (percent < 0 || percent > 100) {
      throw new Error(`Percentage must be between 0 and 100, got: ${percent}`);
    }
    const cents = toCents(m.amount);
    // Multiply with integer scaling for rounding: (cents * percent + 50) / 100
    const scaled = Math.round(Number(cents) * (percent / 100));
    return {
      amount: fromCents(BigInt(scaled)),
      currency: m.currency,
    };
  },

  /**
   * Compares two Money objects. Returns -1 if a < b, 0 if a == b, 1 if a > b.
   */
  compare(a: Money, b: Money): number {
    if (a.currency !== b.currency) {
      throw new Error(`Currency mismatch in compare: ${a.currency} vs ${b.currency}`);
    }
    const aCents = toCents(a.amount);
    const bCents = toCents(b.amount);
    if (aCents < bCents) return -1;
    if (aCents > bCents) return 1;
    return 0;
  },

  isEqual(a: Money, b: Money): boolean {
    return a.currency === b.currency && toCents(a.amount) === toCents(b.amount);
  },

  isGreaterThan(a: Money, b: Money): boolean {
    return this.compare(a, b) > 0;
  },

  isLessThan(a: Money, b: Money): boolean {
    return this.compare(a, b) < 0;
  },

  /**
   * Human-readable formatted string, e.g. "100.00 USD"
   */
  format(m: Money): string {
    return `${m.amount} ${m.currency}`;
  },
};

