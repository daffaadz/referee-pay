import { z } from "zod";

export const dealAnalyticsSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  amount: z.string(),
  currency: z.string(),
  createdAt: z.string(),
  shipDeadline: z.string().nullable(),
  deliveryDeadline: z.string().nullable(),
  reviewEnd: z.string().nullable(),
  hasTracking: z.boolean(),
  riskLevel: z.enum(["low", "medium", "high"]),
  buyerName: z.string().nullable(),
  sellerToken: z.string().optional(),
});

export const paymentAnalyticsSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  dealTitle: z.string().optional(),
  type: z.enum(["authorized", "captured", "voided", "payout"]),
  amount: z.string(),
  currency: z.string(),
  status: z.string(),
  paypalId: z.string().nullable(),
  createdAt: z.string(),
});

export const decisionAnalyticsSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  dealTitle: z.string().optional(),
  action: z.string(),
  confidence: z.number().optional(),
  policyVerdict: z.string(),
  policyReasons: z.array(z.string()).optional(),
  createdAt: z.string(),
});

export const sellerKpiSchema = z.object({
  heldAmount: z.string(),
  heldCount: z.number(),
  releasedAmount30d: z.string(),
  releasedCount30d: z.number(),
  refundedAmount30d: z.string(),
  refundedCount30d: z.number(),
  refundRate: z.string(),
  avgReleaseDays: z.string(),
  currency: z.string(),
});

export const sellerAnalyticsResponseSchema = z.object({
  kpis: sellerKpiSchema,
  deals: z.array(dealAnalyticsSchema),
  payments: z.array(paymentAnalyticsSchema),
  decisions: z.array(decisionAnalyticsSchema),
  pipeline: z.array(
    z.object({
      stage: z.string(),
      count: z.number(),
      amount: z.string(),
      color: z.string(),
    })
  ),
  moneySplit: z.object({
    heldAmount: z.number(),
    releasedAmount: z.number(),
    refundedAmount: z.number(),
    totalAmount: z.number(),
    heldPercent: z.number(),
    releasedPercent: z.number(),
    refundedPercent: z.number(),
  }),
});

export type SellerAnalyticsResponse = z.infer<typeof sellerAnalyticsResponseSchema>;

export function computeRiskLevel(deal: {
  status: string;
  createdAt: Date | string;
  deadlinesJson?: any;
  hasTracking?: boolean;
}): "low" | "medium" | "high" {
  const now = Date.now();
  const createdAt = new Date(deal.createdAt).getTime();
  const deadlines = deal.deadlinesJson || {};

  // High risk:
  if (deal.status === "FUNDS_HELD" && !deal.hasTracking) {
    const shipDays = deadlines.shipDeadlineDays || 3;
    const shipDeadline = deadlines.shipDeadline
      ? new Date(deadlines.shipDeadline).getTime()
      : createdAt + shipDays * 86400000;

    const totalWindow = shipDeadline - createdAt;
    const elapsed = now - createdAt;

    // More than 50% ship window elapsed without tracking
    if (elapsed > totalWindow * 0.5) {
      return "high";
    }
    // More than 30% ship window elapsed
    if (elapsed > totalWindow * 0.3) {
      return "medium";
    }
  }

  if (deal.status === "SHIPPED") {
    const deliveryDays = deadlines.deliveryDeadlineDays || 14;
    const deliveryDeadline = deadlines.deliveryDeadline
      ? new Date(deadlines.deliveryDeadline).getTime()
      : createdAt + deliveryDays * 86400000;

    // Within 24 hours of delivery deadline
    if (deliveryDeadline - now <= 86400000) {
      return "high";
    }
  }

  if (deal.status === "AWAITING_PAYMENT") {
    // Awaiting payment for more than 48h
    if (now - createdAt > 48 * 3600000) {
      return "medium";
    }
  }

  return "low";
}

