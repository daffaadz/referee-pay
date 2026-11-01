"use client";

import React, { useState } from "react";
import { CheckCircle, XCircle, Warning, Cpu, Lightning } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

export interface DecisionLogProps {
  token: string;
  decisions: any[];
  clauses?: Array<{ id: string; text: string }>;
  evidence?: Array<{ id: string; kind: string; contentText?: string }>;
  onRefresh?: () => void;
}

export function DecisionLog({
  token,
  decisions,
  clauses = [],
  evidence = [],
  onRefresh,
}: DecisionLogProps) {
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const handleRunReferee = async () => {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch(`/api/deals/${token}/arbitrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "MANUAL_RERUN" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Arbitration request failed");
      }
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setRunError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const getActionClass = (action: string) => {
    switch (action) {
      case "RELEASE":
        return "bg-success-50 text-success-700 border-success-100";
      case "REFUND":
        return "bg-info-50 text-info-700 border-info-100";
      case "ESCALATE":
        return "bg-warning-50 text-warning-700 border-warning-100";
      default:
        return "bg-neutral-100 text-neutral-800 border-neutral-300";
    }
  };

  const renderVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "ALLOWED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700 border border-success-100">
            <CheckCircle size={13} weight="bold" />
            <span>Policy ALLOWED</span>
          </span>
        );
      case "BLOCKED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-0.5 text-xs font-medium text-danger-700 border border-danger-100">
            <XCircle size={13} weight="bold" />
            <span>Policy BLOCKED</span>
          </span>
        );
      case "ESCALATED":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700 border border-warning-100">
            <Warning size={13} weight="bold" />
            <span>Policy ESCALATED</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h3 className="text-base font-semibold text-neutral-900 font-serif">
            What Referee decided
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5">
            Audit trail of AI proposed resolutions and deterministic Policy Engine checks.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          loading={running}
          onClick={handleRunReferee}
          className="shrink-0"
        >
          Evaluate with Referee
        </Button>
      </div>

      {runError && (
        <div className="rounded-md bg-danger-50 p-3 text-xs text-danger-700 border border-danger-100">
          <strong>Evaluation error:</strong> {runError}
        </div>
      )}

      <div className="space-y-4">
        {decisions.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-neutral-600">
            No decisions logged yet. The Referee evaluates automatically upon tracking updates, delivery, claims, or deadline expirations.
          </div>
        ) : (
          decisions.map((item) => {
            const dec = item.decisionJson || {};
            const action = dec.action || "WAIT";
            const confidencePct = Math.round((dec.confidence ?? 0.8) * 100);

            return (
              <div
                key={item.id}
                className="rounded-md border border-border bg-surface p-4 space-y-3 shadow-xs"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getActionClass(
                        action
                      )}`}
                    >
                      {action}
                    </span>
                    {renderVerdictBadge(item.policyVerdict)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <span className="font-medium bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded-full text-[11px] tabular-nums">
                      {confidencePct}% confidence
                    </span>
                    <span className="text-[11px] tabular-nums">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Rationale */}
                <p className="text-xs text-neutral-800 leading-relaxed font-normal">
                  &ldquo;{dec.rationale || "No rationale provided"}&rdquo;
                </p>

                {/* Chips: Clauses & Evidence */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {(dec.clauseRefs || []).map((cRef: string) => {
                    const clauseObj = clauses.find((c) => c.id === cRef);
                    return (
                      <Tooltip key={cRef} content={clauseObj?.text || "Contract clause"}>
                        <span className="inline-flex items-center rounded-md bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 cursor-help">
                          Clause {cRef}
                        </span>
                      </Tooltip>
                    );
                  })}

                  {(dec.evidenceRefs || []).map((eRef: string) => {
                    const evObj = evidence.find((e) => e.id === eRef);
                    return (
                      <Tooltip
                        key={eRef}
                        content={evObj?.contentText || `Verified evidence ${evObj?.kind || ""}`}
                      >
                        <span className="inline-flex items-center rounded-md bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 cursor-help">
                          Evidence {eRef}: {evObj?.kind?.replace(/_/g, " ") || "verified"}
                        </span>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Policy reasons */}
                {item.policyReasons && item.policyReasons.length > 0 && (
                  <div className="rounded-md bg-neutral-50 p-2.5 text-xs text-neutral-700 border border-border">
                    <span className="font-semibold text-neutral-900">Policy rules: </span>
                    {item.policyReasons.join("; ")}
                  </div>
                )}

                {/* Footer metadata */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-neutral-600 pt-1 border-t border-neutral-100">
                  <div className="flex items-center gap-1">
                    <Lightning size={12} weight="bold" className="text-neutral-500" />
                    <span>Trigger:</span>
                    <span className="font-medium text-neutral-800">{item.trigger}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Cpu size={12} weight="bold" className="text-neutral-500" />
                    <span>Model:</span>
                    <span className="font-medium text-neutral-800">
                      {item.model || "gemini-3.5-flash-lite"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
