"use client";

import React, { useState } from "react";
import { CaretDown, CaretUp, FastForward, Truck } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

export interface DemoControlPanelProps {
  trackingNumber?: string;
  onActionComplete?: () => void;
}

const CARRIER_STATUS_OPTIONS = [
  { value: "In transit", label: "In transit" },
  { value: "Delivered", label: "Delivered (Fulfill deal)" },
  { value: "Returned", label: "Returned to sender" },
  { value: "Label created", label: "Label created" },
];

export function DemoControlPanel({
  trackingNumber = "MCK-123456",
  onActionComplete,
}: DemoControlPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("Delivered");

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
      setFeedback(`Sweeper error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-50 transition cursor-pointer"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-900">
            Demo simulator and testing tools
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-700 tabular-nums">
            1 day = 60s
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-neutral-600 font-medium">
          <span>{expanded ? "Hide tools" : "Show testing tools"}</span>
          {expanded ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 pt-3 border-t border-border space-y-3 bg-neutral-50">
          <p className="text-xs text-neutral-600">
            Simulate real world events such as carrier delivery or time elapsing without waiting days.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Carrier Status */}
            <div className="p-3.5 rounded-md bg-surface border border-border space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                <Truck size={16} weight="bold" className="text-neutral-700" />
                <span>Simulate carrier tracking</span>
              </div>
              <p className="text-[11px] text-neutral-600">
                Tracking: <span className="font-mono text-neutral-800">{trackingNumber}</span>
              </p>
              <div className="space-y-2">
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                  options={CARRIER_STATUS_OPTIONS}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  loading={loading}
                  onClick={handleUpdateCarrier}
                  className="w-full"
                >
                  Apply status
                </Button>
              </div>
            </div>

            {/* 2. Fast Forward Sweeper */}
            <div className="p-3.5 rounded-md bg-surface border border-border space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                  <FastForward size={16} weight="bold" className="text-neutral-700" />
                  <span>Time machine sweeper</span>
                </div>
                <p className="text-[11px] text-neutral-600 mt-1">
                  Trigger the background sweep cron to check inspection windows and auto-release payments.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={loading}
                onClick={handleRunSweeper}
                className="w-full"
              >
                Run background sweeper
              </Button>
            </div>
          </div>

          {feedback && (
            <div className="p-2.5 rounded-sm bg-neutral-100 text-xs text-neutral-800 font-medium">
              {feedback}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
