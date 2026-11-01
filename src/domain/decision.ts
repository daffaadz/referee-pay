import { z } from "zod";

export const decisionActionSchema = z.enum([
  "RELEASE",
  "REFUND",
  "PARTIAL_SETTLEMENT",
  "REQUEST_EVIDENCE",
  "EXTEND_DEADLINE",
  "ESCALATE",
  "WAIT",
]);

export type DecisionAction = z.infer<typeof decisionActionSchema>;

export const decisionSchema = z.object({
  action: decisionActionSchema,
  params: z
    .object({
      sellerSharePercent: z.number().min(10).max(90).optional(),
    })
    .optional(),
  rationale: z
    .string()
    .min(1, "Rationale cannot be empty")
    .refine((val) => val.trim().split(/\s+/).length <= 150, {
      message: "Rationale must be concise (<= 150 words)",
    }),
  clauseRefs: z.array(z.string().regex(/^C[\w-]+$/i)).default([]),
  evidenceRefs: z.array(z.string().regex(/^E[\w-]+$/i)).default([]),
  confidence: z.number().min(0).max(1),
});

export type Decision = z.infer<typeof decisionSchema>;

export const policyVerdictSchema = z.enum(["ALLOWED", "BLOCKED", "ESCALATED"]);

export type PolicyVerdict = z.infer<typeof policyVerdictSchema>;

export interface DecisionRecord {
  id: string;
  dealId: string;
  trigger: string;
  decision: Decision;
  policyVerdict: PolicyVerdict;
  policyReasons: string[];
  model?: string;
  promptVersion?: string;
  createdAt: Date;
}

