import { pgTable, text, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";

export const deals = pgTable("deals", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  contractJson: jsonb("contract_json").notNull(),
  sellerTokenHash: text("seller_token_hash").notNull(),
  buyerTokenHash: text("buyer_token_hash").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  deadlinesJson: jsonb("deadlines_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dealEvents = pgTable("deal_events", {
  id: text("id").primaryKey(),
  dealId: text("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payloadJson: jsonb("payload_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const evidence = pgTable("evidence", {
  id: text("id").primaryKey(),
  dealId: text("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  source: text("source").notNull(),
  contentText: text("content_text"),
  contentHash: text("content_hash"),
  artifactUrl: text("artifact_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const decisions = pgTable("decisions", {
  id: text("id").primaryKey(),
  dealId: text("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  trigger: text("trigger").notNull(),
  decisionJson: jsonb("decision_json").notNull(),
  policyVerdict: text("policy_verdict").notNull(),
  policyReasons: jsonb("policy_reasons"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  dealId: text("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  orderId: text("order_id"),
  authorizationId: text("authorization_id"),
  captureId: text("capture_id"),
  payoutBatchId: text("payout_batch_id"),
  status: text("status").notNull(),
  rawJson: jsonb("raw_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  dealId: text("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  fromRole: text("from_role").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

