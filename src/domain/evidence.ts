import { z } from "zod";
import crypto from "crypto";

export const evidenceKindSchema = z.enum([
  "tracking_snapshot",
  "buyer_claim",
  "seller_note",
  "photo",
  "system_event",
]);

export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

export const evidenceSchema = z.object({
  id: z.string().regex(/^E\d+$/, "Evidence ID must follow format E1, E2, etc."),
  dealId: z.string().min(1),
  kind: evidenceKindSchema,
  source: z.string().min(1, "Evidence source is required"),
  contentText: z.string().optional(),
  contentHash: z.string().optional(),
  artifactUrl: z.string().url().optional(),
  createdAt: z.date().default(() => new Date()),
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type EvidenceRecord = Evidence;

/**
 * Computes a SHA-256 hash for untrusted evidence data to guarantee tamper-evidence.
 */
export function hashEvidenceContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

