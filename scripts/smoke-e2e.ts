// scripts/smoke-e2e.ts
// Automated end-to-end proof of Happy Path and Failure Path (Phase G)

import { db } from "../src/db";
import { deals } from "../src/db/schema";
import { like } from "drizzle-orm";
import { createDeal, recordPayment, addEvidence, getDecisionsForDeal, updateDealStatus } from "../src/db/queries";
import { appendDealEvent } from "../src/db/events";
import { generateCapabilityTokens } from "../src/domain/tokens";
import { executeDecision } from "../src/agent/executor";
import type { DealContract } from "../src/domain/contract";
import type { Decision } from "../src/domain/decision";
import type { FundsHold } from "../src/integrations/paypal/funds-hold";

const mockFundsHold: FundsHold = {
  createOrder: async () => ({ orderId: "ORD-MOCK-E2E" }),
  authorizeOrder: async () => ({ authorizationId: "AUTH-MOCK-E2E", status: "CREATED" }),
  release: async () => ({
    captureId: "CAP-E2E-RELEASED",
    payoutBatchId: "BATCH-E2E-PAID",
    status: "COMPLETED",
  }),
  refund: async () => ({
    voidStatus: "VOIDED",
    statusCode: 204,
  }),
};

const contractTemplate: DealContract = {
  item: {
    title: "Handmade Leather Tote Bag",
    description: "Tan vegetable tanned leather bag",
    price: { amount: "125.00", currency: "USD" },
  },
  seller: { displayName: "Sari", paypalEmail: "sari@example.com" },
  buyer: { displayName: "Maya", paypalEmail: "maya@example.com" },
  terms: {
    shipDeadlineDays: 3,
    deliveryDeadlineDays: 14,
    inspectionWindowDays: 2,
    returnPolicy: { allowed: true, windowDays: 7, returnShippingPaidBy: "buyer" },
    autoReleaseAfterInspection: true,
  },
  clauses: [
    { id: "C1", text: "Buyer funds $125.00 USD into escrow via PayPal." },
    { id: "C2", text: "Seller must ship within 3 days." },
    { id: "C3", text: "Delivery verified via tracking within 14 days." },
    { id: "C4", text: "Buyer inspection window of 2 days." },
  ],
};

async function cleanupTestDeals() {
  try {
    await db.delete(deals).where(like(deals.id, "deal_e2e_%"));
  } catch {
    // Ignore cleanup errors
  }
}

async function runEndToEndSmoke() {
  console.log("=================================================");
  console.log("  REFEREE END-TO-END VERIFICATION (PHASE G)     ");
  console.log("=================================================");

  // ==========================================================
  // PATH 1: HAPPY PATH (Create -> Pay -> Ship -> Verify -> Release)
  // ==========================================================
  console.log("\n--- Testing Path 1: Happy Path ---");
  await cleanupTestDeals();
  const happyDealId = `deal_e2e_happy_${Date.now()}`;

  const tokensHappy = generateCapabilityTokens();
  await createDeal({
    id: happyDealId,
    contract: contractTemplate,
    sellerTokenHash: tokensHappy.sellerTokenHash,
    buyerTokenHash: tokensHappy.buyerTokenHash,
    deadlines: {
      shipDeadline: new Date(Date.now() + 86400000 * 3).toISOString(),
      deliveryDeadline: new Date(Date.now() + 86400000 * 14).toISOString(),
    },
  });
  console.log(`1. Created deal ${happyDealId} in state DRAFT`);

  // Step 2: Pay (Buyer authorizes payment -> FUNDS_HELD)
  const payRecord = await recordPayment({
    dealId: happyDealId,
    orderId: "ord_happy_123",
    authorizationId: "auth_happy_456",
    status: "AUTHORIZED",
  });
  await updateDealStatus(happyDealId, "FUNDS_HELD");
  await appendDealEvent(happyDealId, "PAYMENT_AUTHORIZED", { authorizationId: payRecord.authorizationId });
  console.log(`2. Buyer authorized funds: status -> FUNDS_HELD (auth: ${payRecord.authorizationId})`);

  // Step 3: Ship (Seller provides tracking -> SHIPPED)
  const trackingNumber = "TRK-DELIV-HAPPY-999";
  await updateDealStatus(happyDealId, "SHIPPED");
  await appendDealEvent(happyDealId, "SHIPMENT_ADDED", { carrier: "Mock Carrier", trackingNumber });
  console.log(`3. Seller shipped item: tracking -> ${trackingNumber}, status -> SHIPPED`);

  // Step 4: Kernel cloud browser verification -> DELIVERED
  const evidenceId = "E1";
  await addEvidence({
    id: evidenceId,
    dealId: happyDealId,
    kind: "tracking_snapshot",
    source: "Mock Carrier",
    contentText: "Status: Delivered | Location: Front Porch | Carrier: Referee Parcel Express",
    contentHash: "hash-kernel-verified-delivered",
    artifactUrl: "/artifacts/screenshots/kernel-happy.png",
    createdAt: new Date(),
  });
  const inspectionDeadline = new Date(Date.now() - 3600000); // Window elapsed
  await updateDealStatus(happyDealId, "DELIVERED", {
    inspectionDeadline: inspectionDeadline.toISOString(),
  });
  await appendDealEvent(happyDealId, "DELIVERY_VERIFIED", { evidenceId, trackingNumber });
  console.log(`4. Kernel verified delivery: evidence ${evidenceId} created, status -> DELIVERED`);

  // Step 5: Inspection elapsed -> Referee proposes RELEASE -> executeDecision
  const happyDecision: Decision = {
    action: "RELEASE",
    rationale: "Delivery verified via Kernel tracking snapshot and 2-day inspection window has elapsed without dispute.",
    clauseRefs: ["C3", "C4"],
    evidenceRefs: [evidenceId],
    confidence: 0.98,
  };

  const happyExec = await executeDecision({
    dealId: happyDealId,
    trigger: "INSPECTION_PASSED",
    decision: happyDecision,
    fundsHold: mockFundsHold,
    options: { now: new Date() },
  });

  console.log(`5. Decision executed: verdict -> ${happyExec.verdict}, newStatus -> ${happyExec.newStatus}`);
  console.log(`   Action: ${happyExec.actionExecuted}`);

  // Verify Happy Path assertions
  if (happyExec.verdict !== "ALLOWED" || happyExec.newStatus !== "RELEASED") {
    throw new Error(`Happy path failed! Expected ALLOWED and RELEASED, got ${happyExec.verdict} / ${happyExec.newStatus}`);
  }

  const happyDecisions = await getDecisionsForDeal(happyDealId);
  const happyDecJson = happyDecisions[0].decisionJson as Decision;
  console.log(`[PASS] Decision Log record created: ID ${happyDecisions[0].id}, citing clauses [${happyDecJson.clauseRefs.join(", ")}], evidence [${happyDecJson.evidenceRefs.join(", ")}]`);
  console.log("[PASS] PATH 1 (HAPPY PATH): SUCCESS\n");

  // ==========================================================
  // PATH 2: FAILURE PATH (Create -> Pay -> No Shipment -> Refund)
  // ==========================================================
  console.log("--- Testing Path 2: Failure Path (No Shipment -> Refund) ---");
  const failDealId = `deal_e2e_fail_${Date.now()}`;

  const tokensFail = generateCapabilityTokens();
  const pastShipDeadline = new Date(Date.now() - 86400000 * 2); // 2 days past deadline
  await createDeal({
    id: failDealId,
    contract: contractTemplate,
    sellerTokenHash: tokensFail.sellerTokenHash,
    buyerTokenHash: tokensFail.buyerTokenHash,
    deadlines: {
      shipDeadline: pastShipDeadline.toISOString(),
    },
  });
  console.log(`1. Created deal ${failDealId} in state DRAFT`);

  // Step 2: Pay (Buyer authorizes payment -> FUNDS_HELD)
  const failPayRecord = await recordPayment({
    dealId: failDealId,
    orderId: "ord_fail_123",
    authorizationId: "auth_fail_789",
    status: "AUTHORIZED",
  });
  await updateDealStatus(failDealId, "FUNDS_HELD", {
    shipDeadline: pastShipDeadline.toISOString(),
  });
  console.log(`2. Buyer authorized funds: status -> FUNDS_HELD (auth: ${failPayRecord.authorizationId})`);

  // Step 3: Seller fails to ship -> Deadline sweeper triggers refund
  await appendDealEvent(failDealId, "SHIP_DEADLINE_EXPIRED", {
    shipDeadline: pastShipDeadline.toISOString(),
  });
  console.log(`3. Ship deadline expired with no tracking submitted`);

  // Step 4: Referee proposes REFUND -> executeDecision
  const failDecision: Decision = {
    action: "REFUND",
    rationale: "Seller failed to provide valid tracking within the 3-day deadline. Full refund initiated per contract terms.",
    clauseRefs: ["C2"],
    evidenceRefs: [],
    confidence: 0.95,
  };

  const failExec = await executeDecision({
    dealId: failDealId,
    trigger: "SHIP_DEADLINE_EXPIRED",
    decision: failDecision,
    fundsHold: mockFundsHold,
    options: { now: new Date() },
  });

  console.log(`4. Decision executed: verdict -> ${failExec.verdict}, newStatus -> ${failExec.newStatus}`);
  console.log(`   Action: ${failExec.actionExecuted}`);

  // Verify Failure Path assertions
  if (failExec.verdict !== "ALLOWED" || failExec.newStatus !== "REFUNDED") {
    throw new Error(`Failure path failed! Expected ALLOWED and REFUNDED, got ${failExec.verdict} / ${failExec.newStatus}`);
  }

  const failDecisions = await getDecisionsForDeal(failDealId);
  const failDecJson = failDecisions[0].decisionJson as Decision;
  console.log(`[PASS] Decision Log record created: ID ${failDecisions[0].id}, citing clauses [${failDecJson.clauseRefs.join(", ")}]`);
  console.log("[PASS] PATH 2 (FAILURE PATH): SUCCESS\n");

  console.log("=================================================");
  console.log("  ALL END-TO-END FLOWS VERIFIED SUCCESSFULLY     ");
  console.log("=================================================");
}

runEndToEndSmoke()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("End-to-end smoke test failed:", err);
    process.exit(1);
  });
