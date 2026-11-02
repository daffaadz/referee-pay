import { db } from "./index";
import { deals, dealEvents, decisions, payments, evidence } from "./schema";
import { eq } from "drizzle-orm";
import { generateCapabilityTokens } from "../domain/tokens";
import type { DealContract } from "../domain/contract";

export async function seedDemoSellerData(sellerId: string, sellerEmail = "sari.demo@example.com") {
  const existingDeals = await db
    .select({ id: deals.id })
    .from(deals)
    .where(eq(deals.sellerId, sellerId))
    .limit(5);

  if (existingDeals.length >= 4) {
    return; // Already seeded
  }

  const now = Date.now();
  const day = 86400000;

  // 1. Shipped Active Deal ($280.00)
  const d1Id = `deal_demo_shipped_${Date.now()}`;
  const d1Tokens = generateCapabilityTokens();
  const d1Contract: DealContract = {
    item: { title: "Vintage Camera Lens 50mm f/1.4", description: "Mint condition vintage manual focus prime lens", price: { amount: "280.00", currency: "USD" } },
    seller: { displayName: "Sari", paypalEmail: sellerEmail },
    buyer: { displayName: "Lucas", paypalEmail: "lucas@example.com" },
    terms: { shipDeadlineDays: 3, deliveryDeadlineDays: 14, inspectionWindowDays: 2, returnPolicy: { allowed: true, windowDays: 7, returnShippingPaidBy: "buyer" }, autoReleaseAfterInspection: true },
    clauses: [
      { id: "C1", text: "Buyer funds $280.00 USD into escrow via PayPal." },
      { id: "C2", text: "Seller must ship within 3 days." },
      { id: "C3", text: "Delivery verified via tracking within 14 days." },
      { id: "C4", text: "Buyer inspection window of 2 days." },
    ],
  };

  await db.insert(deals).values({
    id: d1Id,
    sellerId,
    status: "SHIPPED",
    contractJson: d1Contract,
    sellerTokenHash: d1Tokens.sellerTokenHash,
    buyerTokenHash: d1Tokens.buyerTokenHash,
    amount: "280.00",
    currency: "USD",
    deadlinesJson: {
      shipDeadlineDays: 3,
      deliveryDeadlineDays: 14,
      inspectionWindowDays: 2,
      shipDeadline: new Date(now - 1 * day + 3 * day).toISOString(),
      deliveryDeadline: new Date(now - 1 * day + 14 * day).toISOString(),
    },
    createdAt: new Date(now - 2 * day),
  });

  await db.insert(payments).values({
    id: `pay_d1_auth`,
    dealId: d1Id,
    orderId: "ord_demo_d1",
    authorizationId: "auth_demo_d1_280",
    status: "AUTHORIZED",
    createdAt: new Date(now - 2 * day),
  });

  await db.insert(dealEvents).values({
    id: `ev_d1_ship`,
    dealId: d1Id,
    type: "SHIPMENT_ADDED",
    payloadJson: { carrier: "Mock Carrier", trackingNumber: "TRK-CAM-9921" },
    createdAt: new Date(now - 1 * day),
  });

  // 2. High Risk Deal ($150.00 - FUNDS_HELD, 80% ship window elapsed, no tracking)
  const d2Id = `deal_demo_risk_${Date.now() + 1}`;
  const d2Tokens = generateCapabilityTokens();
  const d2Contract: DealContract = {
    item: { title: "Handmade Ceramic Dinner Set", description: "Set of 4 artisan glazed plates and bowls", price: { amount: "150.00", currency: "USD" } },
    seller: { displayName: "Sari", paypalEmail: sellerEmail },
    buyer: { displayName: "Clara", paypalEmail: "clara@example.com" },
    terms: { shipDeadlineDays: 3, deliveryDeadlineDays: 10, inspectionWindowDays: 2, returnPolicy: { allowed: true, windowDays: 7, returnShippingPaidBy: "buyer" }, autoReleaseAfterInspection: true },
    clauses: [
      { id: "C1", text: "Buyer funds $150.00 USD into escrow." },
      { id: "C2", text: "Seller ships within 3 days." },
    ],
  };

  await db.insert(deals).values({
    id: d2Id,
    sellerId,
    status: "FUNDS_HELD",
    contractJson: d2Contract,
    sellerTokenHash: d2Tokens.sellerTokenHash,
    buyerTokenHash: d2Tokens.buyerTokenHash,
    amount: "150.00",
    currency: "USD",
    deadlinesJson: {
      shipDeadlineDays: 3,
      deliveryDeadlineDays: 10,
      inspectionWindowDays: 2,
      shipDeadline: new Date(now + 0.5 * day).toISOString(),
      deliveryDeadline: new Date(now + 8 * day).toISOString(),
    },
    createdAt: new Date(now - 2.5 * day), // 2.5 days elapsed of 3 days
  });

  await db.insert(payments).values({
    id: `pay_d2_auth`,
    dealId: d2Id,
    orderId: "ord_demo_d2",
    authorizationId: "auth_demo_d2_150",
    status: "AUTHORIZED",
    createdAt: new Date(now - 2.5 * day),
  });

  // 3. Released Deal ($120.00 - RELEASED)
  const d3Id = `deal_demo_released_${Date.now() + 2}`;
  const d3Tokens = generateCapabilityTokens();
  const d3Contract: DealContract = {
    item: { title: "Mechanical Split Keyboard", description: "Custom ergonomic keyboard with walnut wrist rest", price: { amount: "120.00", currency: "USD" } },
    seller: { displayName: "Sari", paypalEmail: sellerEmail },
    buyer: { displayName: "Maya", paypalEmail: "maya@example.com" },
    terms: { shipDeadlineDays: 3, deliveryDeadlineDays: 14, inspectionWindowDays: 2, returnPolicy: { allowed: true, windowDays: 7, returnShippingPaidBy: "buyer" }, autoReleaseAfterInspection: true },
    clauses: [
      { id: "C1", text: "Buyer funds $120.00 USD." },
      { id: "C2", text: "Delivery verified via tracking." },
      { id: "C3", text: "Automatic fund release upon inspection." },
    ],
  };

  await db.insert(deals).values({
    id: d3Id,
    sellerId,
    status: "RELEASED",
    contractJson: d3Contract,
    sellerTokenHash: d3Tokens.sellerTokenHash,
    buyerTokenHash: d3Tokens.buyerTokenHash,
    amount: "120.00",
    currency: "USD",
    deadlinesJson: { shipDeadlineDays: 3, deliveryDeadlineDays: 14, inspectionWindowDays: 2 },
    createdAt: new Date(now - 5 * day),
  });

  await db.insert(payments).values([
    {
      id: `pay_d3_auth`,
      dealId: d3Id,
      orderId: "ord_demo_d3",
      authorizationId: "auth_demo_d3_120",
      captureId: "cap_demo_d3_120",
      payoutBatchId: "batch_demo_d3_120",
      status: "COMPLETED",
      createdAt: new Date(now - 5 * day),
    },
  ]);

  await db.insert(decisions).values({
    id: `dec_demo_d3`,
    dealId: d3Id,
    trigger: "INSPECTION_WINDOW_EXPIRED",
    decisionJson: {
      action: "RELEASE",
      reasons: ["Item delivered and verified via tracking", "Buyer inspection period concluded without disputes"],
      citedClauses: ["C2", "C3"],
      citedEvidence: ["E1"],
    },
    policyVerdict: "ALLOWED",
    policyReasons: ["All release conditions satisfied"],
    createdAt: new Date(now - 2 * day),
  });

  // 4. Refunded Deal ($75.00 - REFUNDED)
  const d4Id = `deal_demo_refund_${Date.now() + 3}`;
  const d4Tokens = generateCapabilityTokens();
  const d4Contract: DealContract = {
    item: { title: "Noise Cancelling Headphones", description: "Wireless over-ear headphones", price: { amount: "75.00", currency: "USD" } },
    seller: { displayName: "Sari", paypalEmail: sellerEmail },
    buyer: { displayName: "David", paypalEmail: "david@example.com" },
    terms: { shipDeadlineDays: 2, deliveryDeadlineDays: 7, inspectionWindowDays: 1, returnPolicy: { allowed: false, windowDays: 0, returnShippingPaidBy: "buyer" }, autoReleaseAfterInspection: true },
    clauses: [
      { id: "C1", text: "Buyer funds $75.00 USD." },
      { id: "C2", text: "Seller must ship within 2 days or refund." },
    ],
  };

  await db.insert(deals).values({
    id: d4Id,
    sellerId,
    status: "REFUNDED",
    contractJson: d4Contract,
    sellerTokenHash: d4Tokens.sellerTokenHash,
    buyerTokenHash: d4Tokens.buyerTokenHash,
    amount: "75.00",
    currency: "USD",
    deadlinesJson: { shipDeadlineDays: 2, deliveryDeadlineDays: 7, inspectionWindowDays: 1 },
    createdAt: new Date(now - 6 * day),
  });

  await db.insert(payments).values([
    {
      id: `pay_d4_void`,
      dealId: d4Id,
      orderId: "ord_demo_d4",
      authorizationId: "auth_demo_d4_75",
      status: "VOIDED",
      createdAt: new Date(now - 6 * day),
    },
  ]);

  await db.insert(decisions).values({
    id: `dec_demo_d4`,
    dealId: d4Id,
    trigger: "SHIP_DEADLINE_EXPIRED",
    decisionJson: {
      action: "REFUND",
      reasons: ["Seller failed to provide tracking before shipping deadline"],
      citedClauses: ["C2"],
    },
    policyVerdict: "ALLOWED",
    policyReasons: ["Shipping window expired with no fulfillment proof"],
    createdAt: new Date(now - 4 * day),
  });

  // 5. Delivered in Inspection ($95.00 - DELIVERED)
  const d5Id = `deal_demo_deliv_${Date.now() + 4}`;
  const d5Tokens = generateCapabilityTokens();
  const d5Contract: DealContract = {
    item: { title: "Leather Messenger Bag", description: "Handcrafted briefcase bag in vegetable tanned leather", price: { amount: "95.00", currency: "USD" } },
    seller: { displayName: "Sari", paypalEmail: sellerEmail },
    buyer: { displayName: "Elena", paypalEmail: "elena@example.com" },
    terms: { shipDeadlineDays: 3, deliveryDeadlineDays: 10, inspectionWindowDays: 2, returnPolicy: { allowed: true, windowDays: 7, returnShippingPaidBy: "buyer" }, autoReleaseAfterInspection: true },
    clauses: [{ id: "C1", text: "Buyer funds $95.00 USD." }],
  };

  await db.insert(deals).values({
    id: d5Id,
    sellerId,
    status: "DELIVERED",
    contractJson: d5Contract,
    sellerTokenHash: d5Tokens.sellerTokenHash,
    buyerTokenHash: d5Tokens.buyerTokenHash,
    amount: "95.00",
    currency: "USD",
    deadlinesJson: {
      shipDeadlineDays: 3,
      deliveryDeadlineDays: 10,
      inspectionWindowDays: 2,
      reviewEnd: new Date(now + 1 * day).toISOString(),
    },
    createdAt: new Date(now - 3 * day),
  });

  await db.insert(payments).values({
    id: `pay_d5_auth`,
    dealId: d5Id,
    orderId: "ord_demo_d5",
    authorizationId: "auth_demo_d5_95",
    status: "AUTHORIZED",
    createdAt: new Date(now - 3 * day),
  });

  // 6. Awaiting Payment ($220.00)
  const d6Id = `deal_demo_await_${Date.now() + 5}`;
  const d6Tokens = generateCapabilityTokens();
  const d6Contract: DealContract = {
    item: { title: "Studio Monitor Headphones", description: "Professional closed-back studio monitors", price: { amount: "220.00", currency: "USD" } },
    seller: { displayName: "Sari", paypalEmail: sellerEmail },
    buyer: { displayName: "Marcus", paypalEmail: "marcus@example.com" },
    terms: { shipDeadlineDays: 3, deliveryDeadlineDays: 14, inspectionWindowDays: 2, returnPolicy: { allowed: true, windowDays: 7, returnShippingPaidBy: "buyer" }, autoReleaseAfterInspection: true },
    clauses: [{ id: "C1", text: "Buyer funds $220.00 USD." }],
  };

  await db.insert(deals).values({
    id: d6Id,
    sellerId,
    status: "AWAITING_PAYMENT",
    contractJson: d6Contract,
    sellerTokenHash: d6Tokens.sellerTokenHash,
    buyerTokenHash: d6Tokens.buyerTokenHash,
    amount: "220.00",
    currency: "USD",
    deadlinesJson: { shipDeadlineDays: 3, deliveryDeadlineDays: 14, inspectionWindowDays: 2 },
    createdAt: new Date(now - 0.5 * day),
  });
}

