"use client";

import React, { useState } from "react";

export interface DemoControlPanelProps {
  trackingNumber?: string;
  onActionComplete?: () => void;
}

export function DemoControlPanel({
  trackingNumber = "MCK-123456",
  onActionComplete,
}: DemoControlPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<
    "Label created" | "In transit" | "Delivered" | "Returned"
  >("Delivered");

  const handleUpdateCarrier = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/demo/carrier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber,
          status: selectedStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update carrier");
      setFeedback(`Carrier status updated to '${selectedStatus}' for ${trackingNumber}`);
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSweeper = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/internal/sweep", {
        method: "POST",
        headers: {
          "x-internal-secret": "referee-internal-sweep-secret-demo",
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sweeper failed");
      const count = data.actionsTaken?.length || 0;
      setFeedback(
        `Sweeper ran: ${data.activeDealsScanned} deals checked, ${count} actions processed.`
      );
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      setFeedback(`Sweeper Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden transition-all">
      {/* Header / Toggle Bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Demo Simulator & Testing Tools
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            1 day = 60s
          </span>
        </div>
        <span className="text-xs text-zinc-400 font-medium">
          {expanded ? "Hide Tools ▲" : "Show Testing Tools ▼"}
        </span>
      </button>

      {/* Expanded Controls */}
      {expanded && (
        <div className="p-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/50">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Use these controls to simulate real-world events (carrier package delivery, time elapsing) without waiting days.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Carrier Status */}
            <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                1. Simulate Carrier Tracking
              </span>
              <p className="text-[11px] text-zinc-400">
                Tracking: <span className="font-mono text-zinc-600 dark:text-zinc-300">{trackingNumber}</span>
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200"
                >
                  <option value="In transit">In transit</option>
                  <option value="Delivered">Delivered (Fulfill Deal)</option>
                  <option value="Returned">Returned to sender</option>
                  <option value="Label created">Label created</option>
                </select>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleUpdateCarrier}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium transition disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* 2. Fast Forward Sweeper */}
            <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                2. Fast-Forward Time Machine
              </span>
              <p className="text-[11px] text-zinc-400">
                Trigger background sweep cron to check inspection windows and auto-release.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={handleRunSweeper}
                className="w-full py-1.5 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>Run Background Sweeper</span>
              </button>
            </div>
          </div>

          {feedback && (
            <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
              {feedback}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
