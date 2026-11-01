import { z } from "zod";
import { moneySchema, Money } from "./money";

export const clauseSchema = z.object({
  id: z.string().regex(/^C\d+$/, "Clause ID must follow format C1, C2, etc."),
  text: z.string().min(1, "Clause text cannot be empty"),
});

export type Clause = z.infer<typeof clauseSchema>;

export const dealContractSchema = z.object({
  item: z.object({
    title: z.string().min(1, "Item title is required").max(120),
    description: z.string().min(1, "Item description is required").max(1000),
    price: moneySchema,
  }),
  seller: z.object({
    displayName: z.string().min(1, "Seller name is required"),
    paypalEmail: z.string().email("Seller must have a valid PayPal email"),
  }),
  buyer: z
    .object({
      displayName: z.string().optional(),
      paypalEmail: z.string().email().optional(),
    })
    .default({}),
  terms: z.object({
    shipDeadlineDays: z.number().int().min(1).max(30).default(3),
    deliveryDeadlineDays: z.number().int().min(1).max(60).default(14),
    inspectionWindowDays: z.number().int().min(1).max(14).default(2),
    returnPolicy: z.object({
      allowed: z.boolean().default(true),
      windowDays: z.number().int().min(0).max(30).default(7),
      returnShippingPaidBy: z.enum(["buyer", "seller"]).default("buyer"),
    }),
    autoReleaseAfterInspection: z.literal(true).default(true),
  }),
  clauses: z.array(clauseSchema).min(1, "Contract must contain at least one clause"),
});

export type DealContract = z.infer<typeof dealContractSchema>;

/**
 * Generates standard standard human-readable clauses for a DealContract
 * if none are provided or to supplement draft contracts.
 */
export function generateDefaultClauses(terms: DealContract["terms"], price: Money): Clause[] {
  return [
    {
      id: "C1",
      text: `Buyer funds the full amount of ${price.amount} ${price.currency} via PayPal. Funds are held in escrow by Referee until verified fulfillment.`,
    },
    {
      id: "C2",
      text: `Seller must ship the item and provide valid tracking information within ${terms.shipDeadlineDays} days of funding. Failure to ship triggers a full refund.`,
    },
    {
      id: "C3",
      text: `Delivery must be verified via tracking within ${terms.deliveryDeadlineDays} days of shipping.`,
    },
    {
      id: "C4",
      text: `Buyer has an inspection window of ${terms.inspectionWindowDays} days after verified delivery to confirm receipt or open a claim. If no claim is opened, funds are released to the seller automatically.`,
    },
    {
      id: "C5",
      text: `Returns are ${terms.returnPolicy.allowed ? "allowed" : "not allowed"} within ${terms.returnPolicy.windowDays} days. Return shipping is paid by the ${terms.returnPolicy.returnShippingPaidBy}.`,
    },
  ];
}

