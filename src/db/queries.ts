import { db } from "./index";
import { sellers, deals, dealEvents, evidence, decisions, payments, messages } from "./schema";
import { eq, or, and, desc, notInArray } from "drizzle-orm";
import { hashToken, resolveRoleByToken, Role } from "../domain/tokens";
import type { DealStatus, DealEvent, DealEventType } from "../domain/state-machine";
import type { DealContract } from "../domain/contract";
import type { Evidence } from "../domain/evidence";
import type { DecisionRecord } from "../domain/decision";
import crypto from "crypto";

export type Seller = typeof sellers.$inferSelect;

export interface CreateDealInput {
  id: string;
  sellerId?: string | null;
  contract: DealContract;
  sellerTokenHash: string;
  buyerTokenHash: string;
  deadlines?: Record<string, unknown>;
}

export async function createDeal(input: CreateDealInput) {
  const row = {
    id: input.id,
    sellerId: input.sellerId || null,
    status: "DRAFT" as DealStatus,
    contractJson: input.contract,
    sellerTokenHash: input.sellerTokenHash,
    buyerTokenHash: input.buyerTokenHash,
    amount: input.contract.item.price.amount,
    currency: input.contract.item.price.currency,
    deadlinesJson: input.deadlines || null,
    createdAt: new Date(),
  };

  await db.insert(deals).values(row);
  return row;
}

export async function upsertSeller(input: {
  paypalSub: string;
  email: string;
  emailVerified?: boolean;
  name?: string | null;
}) {
  const existing = await db
    .select()
    .from(sellers)
    .where(eq(sellers.paypalSub, input.paypalSub))
    .limit(1);

  if (existing.length > 0) {
    const updated = {
      email: input.email,
      emailVerified: input.emailVerified ?? existing[0].emailVerified,
      name: input.name !== undefined ? input.name : existing[0].name,
    };
    await db.update(sellers).set(updated).where(eq(sellers.id, existing[0].id));
    return { ...existing[0], ...updated };
  }

  const id = `seller_${crypto.randomUUID()}`;
  const row = {
    id,
    paypalSub: input.paypalSub,
    email: input.email,
    emailVerified: input.emailVerified ?? true,
    name: input.name || null,
    createdAt: new Date(),
  };
  await db.insert(sellers).values(row);
  return row;
}

export async function getSellerById(id: string) {
  const result = await db.select().from(sellers).where(eq(sellers.id, id)).limit(1);
  return result[0] || null;
}

export async function getSellerByPaypalSub(paypalSub: string) {
  const result = await db.select().from(sellers).where(eq(sellers.paypalSub, paypalSub)).limit(1);
  return result[0] || null;
}

export async function getDealsBySellerId(sellerId: string) {
  return await db
    .select()
    .from(deals)
    .where(eq(deals.sellerId, sellerId))
    .orderBy(desc(deals.createdAt));
}

export async function getDealById(dealId: string) {
  const result = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  return result[0] || null;
}

export async function getActiveDeals() {
  return await db
    .select()
    .from(deals)
    .where(
      notInArray(deals.status, [
        "RELEASED",
        "REFUNDED",
        "SETTLED",
        "CANCELLED",
        "DRAFT",
      ])
    );
}

export async function getDealByToken(token: string): Promise<{ deal: typeof deals.$inferSelect; role: Role } | null> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select()
    .from(deals)
    .where(
      or(
        eq(deals.sellerTokenHash, tokenHash),
        eq(deals.buyerTokenHash, tokenHash),
        eq(deals.id, token)
      )
    )
    .limit(1);

  const deal = rows[0];
  if (!deal) return null;

  if (deal.id === token) {
    return { deal, role: "seller" };
  }

  const role = resolveRoleByToken(token, deal.sellerTokenHash, deal.buyerTokenHash);
  if (!role) return null;

  return { deal, role };
}

export async function updateDealStatus(dealId: string, status: DealStatus, deadlines?: Record<string, unknown>) {
  const updatePayload: Record<string, unknown> = { status };
  if (deadlines) {
    updatePayload.deadlinesJson = deadlines;
  }
  await db.update(deals).set(updatePayload).where(eq(deals.id, dealId));
}

export async function updateDealDeadlines(dealId: string, deadlines: Record<string, unknown>) {
  await db.update(deals).set({ deadlinesJson: deadlines }).where(eq(deals.id, dealId));
}

export async function recordPayment(input: {
  dealId: string;
  orderId?: string;
  authorizationId?: string;
  captureId?: string;
  payoutBatchId?: string;
  status: string;
  rawJson?: Record<string, unknown>;
}) {
  // If payment row exists for this deal and orderId, update it
  if (input.orderId) {
    const existing = await db
      .select()
      .from(payments)
      .where(and(eq(payments.dealId, input.dealId), eq(payments.orderId, input.orderId)))
      .limit(1);

    if (existing.length > 0) {
      const updateData: Record<string, unknown> = {
        status: input.status,
      };
      if (input.authorizationId) updateData.authorizationId = input.authorizationId;
      if (input.captureId) updateData.captureId = input.captureId;
      if (input.payoutBatchId) updateData.payoutBatchId = input.payoutBatchId;
      if (input.rawJson) updateData.rawJson = input.rawJson;

      await db.update(payments).set(updateData).where(eq(payments.id, existing[0].id));
      return { ...existing[0], ...updateData };
    }
  }

  const id = `pay_${crypto.randomUUID()}`;
  const row = {
    id,
    dealId: input.dealId,
    orderId: input.orderId || null,
    authorizationId: input.authorizationId || null,
    captureId: input.captureId || null,
    payoutBatchId: input.payoutBatchId || null,
    status: input.status,
    rawJson: input.rawJson || null,
    createdAt: new Date(),
  };

  await db.insert(payments).values(row);
  return row;
}

export async function updatePayment(
  paymentId: string,
  updates: {
    authorizationId?: string;
    captureId?: string;
    payoutBatchId?: string;
    status?: string;
    rawJson?: Record<string, unknown>;
  }
) {
  await db.update(payments).set(updates).where(eq(payments.id, paymentId));
}

export async function getPaymentByDealId(dealId: string) {
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.dealId, dealId))
    .orderBy(desc(payments.createdAt));

  // Prioritize the record that has authorizationId
  const authorized = rows.find((r) => Boolean(r.authorizationId));
  return authorized || rows[0] || null;
}

export async function getPaymentByOrderId(orderId: string) {
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);
  return rows[0] || null;
}

export const getPaymentForDeal = getPaymentByDealId;

export async function recordDecision(record: DecisionRecord) {
  await db.insert(decisions).values({
    id: record.id,
    dealId: record.dealId,
    trigger: record.trigger,
    decisionJson: record.decision,
    policyVerdict: record.policyVerdict,
    policyReasons: record.policyReasons,
    model: record.model || null,
    promptVersion: record.promptVersion || null,
    createdAt: record.createdAt,
  });
}

export async function getDecisionsForDeal(dealId: string) {
  return await db.select().from(decisions).where(eq(decisions.dealId, dealId));
}

export async function addEvidence(item: Evidence) {
  await db.insert(evidence).values({
    id: item.id,
    dealId: item.dealId,
    kind: item.kind,
    source: item.source,
    contentText: item.contentText || null,
    contentHash: item.contentHash || null,
    artifactUrl: item.artifactUrl || null,
    createdAt: item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt),
  });
}

export async function getEvidenceForDeal(dealId: string): Promise<Evidence[]> {
  const rows = await db.select().from(evidence).where(eq(evidence.dealId, dealId));
  return rows.map((r) => ({
    id: r.id,
    dealId: r.dealId,
    kind: r.kind as Evidence["kind"],
    source: r.source,
    contentText: r.contentText || undefined,
    contentHash: r.contentHash || undefined,
    artifactUrl: r.artifactUrl || undefined,
    createdAt: r.createdAt,
  }));
}

