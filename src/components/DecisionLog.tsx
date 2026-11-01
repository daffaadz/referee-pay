"use client";

import React, { useState } from "react";

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

  const getActionBadge = (action: string) => {
    switch (action) {
      case "RELEASE":
        return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
      case "REFUND":
        return "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300";
      case "ESCALATE":
        return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
      default:
        return "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200";
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "ALLOWED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Policy ALLOWED
          </span>
        );
      case "BLOCKED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            Policy BLOCKED
          </span>
        );
      case "ESCALATED":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Policy ESCALATED
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Arbitration Decision Log
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Audit trail of AI proposed resolutions and deterministic Policy Engine checks.
          </p>
        </div>

        <button
          onClick={handleRunReferee}
          disabled={running}
          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 shadow-sm disabled:opacity-50 transition"
        >
          {running ? "Evaluating..." : "Run AI Arbiter Evaluation"}
        </button>
      </div>

      {runError && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
          <strong>Arbiter Error:</strong> {runError}
        </div>
      )}

      <div className="space-y-3">
        {decisions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-400">
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
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${getActionBadge(
                        action
                      )}`}
                    >
                      {action}
                    </span>
                    {getVerdictBadge(item.policyVerdict)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded text-[11px]">
                      {confidencePct}% confidence
                    </span>
                    <span className="text-[11px]">{new Date(item.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Rationale */}
                <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed">
                  &ldquo;{dec.rationale || "No rationale provided"}&rdquo;
                </p>

                {/* Chips: Clauses & Evidence */}
                <div className="flex flex-wrap gap-1.5">
                  {(dec.clauseRefs || []).map((cRef: string) => {
                    const clauseObj = clauses.find((c) => c.id === cRef);
                    return (
                      <span
                        key={cRef}
                        title={clauseObj?.text || "Contract Clause"}
                        className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-400"
                      >
                        Clause {cRef}
                      </span>
                    );
                  })}

                  {(dec.evidenceRefs || []).map((eRef: string) => {
                    const evObj = evidence.find((e) => e.id === eRef);
                    return (
                      <span
                        key={eRef}
                        title={evObj?.contentText || "Verified Evidence"}
                        className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-400"
                      >
                        Evidence {eRef}: {evObj?.kind || "checked"}
                      </span>
                    );
                  })}
                </div>

                {/* Policy reasons */}
                {item.policyReasons && item.policyReasons.length > 0 && (
                  <div className="rounded-lg bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">Policy Rules: </span>
                    {item.policyReasons.join("; ")}
                  </div>
                )}

                {/* Footer metadata */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 pt-1">
                  <div>
                    Trigger: <span className="font-medium text-zinc-600 dark:text-zinc-300">{item.trigger}</span>
                  </div>
                  <div>
                    Model: <span className="font-medium text-zinc-600 dark:text-zinc-300">{item.model || "gemini-3.5-flash-lite"}</span>
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
