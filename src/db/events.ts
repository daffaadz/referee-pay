import { db } from "./index";
import { dealEvents } from "./schema";
import { eq, asc } from "drizzle-orm";
import type { DealEventType, DealEvent } from "../domain/state-machine";
export type { DealEventType, DealEvent };
import crypto from "crypto";

/**
 * Appends an immutable audit event to the deal_events table.
 */
export async function appendDealEvent(
  dealId: string,
  type: DealEventType,
  payload?: Record<string, unknown>
): Promise<DealEvent> {
  const id = `evt_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(dealEvents).values({
    id,
    dealId,
    type,
    payloadJson: payload,
    createdAt: now,
  });

  return {
    id,
    dealId,
    type,
    payload,
    createdAt: now,
  };
}

/**
 * Retrieves all events for a deal in chronological order to construct the timeline.
 */
export async function getDealEvents(dealId: string): Promise<DealEvent[]> {
  const rows = await db
    .select()
    .from(dealEvents)
    .where(eq(dealEvents.dealId, dealId))
    .orderBy(asc(dealEvents.createdAt));

  return rows.map((r) => ({
    id: r.id,
    dealId: r.dealId,
    type: r.type as DealEventType,
    payload: (r.payloadJson as Record<string, unknown>) || undefined,
    createdAt: r.createdAt,
  }));
}

export const getEventsForDeal = getDealEvents;

export async function appendEvent(event: {
  dealId: string;
  type: DealEventType;
  payload?: Record<string, unknown>;
}): Promise<DealEvent> {
  return appendDealEvent(event.dealId, event.type, event.payload);
}

