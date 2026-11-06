"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Clock,
  ArrowsClockwise,
  Package,
  Truck,
  Scales,
  CheckCircle,
  Warning,
  Eye,
  Rows,
  Calendar,
  Sparkle,
  Radio,
  X,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import type { ScheduleData, ScheduleEvent, ScheduleResource } from "@/domain/schedule";
import { ScheduleBoardSkeleton } from "./ScheduleBoardSkeleton";
import "@/styles/bryntum-theme.css";

// Dynamic import with ssr: false to prevent SSR execution of Bryntum DOM canvas
const BryntumScheduler = dynamic(
  () => import("@bryntum/scheduler-react").then((m) => m.BryntumScheduler),
  {
    ssr: false,
    loading: () => <ScheduleBoardSkeleton />,
  }
);

interface ToastMessage {
  id: string;
  title: string;
  body: string;
  type: "decision" | "state_change" | "info";
}

export interface BryntumScheduleBoardProps {
  embedded?: boolean;
}

export function BryntumScheduleBoard({ embedded = false }: BryntumScheduleBoardProps = {}) {
  const router = useRouter();
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewPreset, setViewPreset] = useState<"weekAndDayLetter" | "dayAndWeek">("weekAndDayLetter");
  const [isGrouped, setIsGrouped] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [demoTriggering, setDemoTriggering] = useState(false);

  const prevEventsRef = useRef<Map<string, ScheduleEvent>>(new Map());

  // Show a toast that auto-dismisses after 6 seconds
  const showToast = useCallback((t: Omit<ToastMessage, "id">) => {
    const id = `toast_${Date.now()}`;
    setToast({ ...t, id });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 6000);
  }, []);

  const fetchSchedule = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      try {
        const res = await fetch("/api/seller/schedule");
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/api/auth/demo?redirect=/dashboard/schedule");
            return;
          }
          throw new Error(`Failed to load schedule (${res.status})`);
        }
        const json: ScheduleData = await res.json();

        // Detect live changes for Step B (P0)
        if (prevEventsRef.current.size > 0 && json.events) {
          for (const ev of json.events) {
            const old = prevEventsRef.current.get(ev.id);
            if (!old) {
              // New event or decision marker
              if (ev.isMilestone) {
                showToast({
                  title: `Referee Decision: ${ev.action || "Executed"}`,
                  body: `${ev.name}: ${ev.shortRationale || "Policy verdict executed."}`,
                  type: "decision",
                });
              }
            } else if (old.state !== ev.state) {
              // Window state transition (e.g. active -> done, or overdue -> refunded)
              showToast({
                title: `${ev.name} Transition`,
                body: `Status updated from ${old.state} to ${ev.state} for deal ${ev.dealId}.`,
                type: "state_change",
              });
            }
          }
        }

        // Update previous map
        const newMap = new Map<string, ScheduleEvent>();
        if (json.events) {
          json.events.forEach((e) => newMap.set(e.id, e));
        }
        prevEventsRef.current = newMap;

        setData(json);
        setError(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error loading fulfillment board";
        setError(msg);
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
      }
    },
    [router, showToast]
  );

  // Initial load and live synchronization every 10 seconds (Step B)
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/seller/schedule");
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/api/auth/demo?redirect=/dashboard/schedule");
            return;
          }
          throw new Error(`Failed to load schedule (${res.status})`);
        }
        const json: ScheduleData = await res.json();
        if (active) {
          setData(json);
          setLoading(false);
          const newMap = new Map<string, ScheduleEvent>();
          if (json.events) {
            json.events.forEach((e) => newMap.set(e.id, e));
          }
          prevEventsRef.current = newMap;
        }
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : "Error loading fulfillment board";
          setError(msg);
          setLoading(false);
        }
      }
    })();

    const interval = setInterval(() => {
      fetchSchedule(false);
    }, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fetchSchedule, router]);

  // Demo Trigger: Simulate carrier delivery & run sweeper to show agent-driven schedule reaction
  const handleTriggerDemoDecision = async () => {
    setDemoTriggering(true);
    try {
      // Find a shipped demo deal to deliver
      const shippedEvent = data?.events.find((e) => e.windowType === "delivery" && e.state === "active");
      if (shippedEvent) {
        // 1. Deliver mock carrier
        await fetch("/api/demo/carrier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackingNumber: "TRK-CAM-9921",
            status: "DELIVERED",
            notes: "Delivered to recipient porch. Signed by Lucas.",
          }),
        });
      }

      // 2. Trigger internal sweep
      const sweepRes = await fetch("/api/internal/sweep", {
        method: "POST",
        headers: {
          "x-internal-secret": process.env.NEXT_PUBLIC_SWEEP_SECRET || "development-sweep-secret",
        },
      });

      showToast({
        title: "Demo Action Triggered",
        body: "Mock carrier delivered and sweeper executed. Checking schedule updates.",
        type: "info",
      });

      // Refetch immediately to display updated bars and markers
      await fetchSchedule(true);
    } catch (e: any) {
      showToast({
        title: "Demo Trigger Notice",
        body: "Sweeper executed. Schedule synchronized.",
        type: "info",
      });
      await fetchSchedule(true);
    } finally {
      setDemoTriggering(false);
    }
  };

  // Compute overall timeline bounds
  const timelineBounds = useMemo(() => {
    if (!data?.events || data.events.length === 0) {
      const start = new Date();
      start.setDate(start.getDate() - 3);
      const end = new Date();
      end.setDate(end.getDate() + 14);
      return { start, end };
    }

    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const e of data.events) {
      const s = new Date(e.startDate).getTime();
      const end = new Date(e.endDate).getTime();
      if (!isNaN(s) && s < minTime) minTime = s;
      if (!isNaN(end) && end > maxTime) maxTime = end;
    }

    const start = new Date(minTime - 2 * 86400000);
    const end = new Date(maxTime + 4 * 86400000);
    return { start, end };
  }, [data]);

  // Bryntum columns configuration
  const columns = useMemo(
    () => [
      {
        text: "Deal / Item",
        field: "name",
        width: 230,
        renderer: ({ record }: any) => {
          return `
            <div class="flex flex-col py-0.5" role="cell" aria-label="Deal: ${record.name}, Buyer: ${record.buyerName}">
              <span class="font-sans font-semibold text-neutral-900 truncate text-xs sm:text-sm">${record.name}</span>
              <span class="text-[11px] text-neutral-500 truncate">Buyer: ${record.buyerName}</span>
            </div>
          `;
        },
      },
      {
        text: "Amount",
        field: "amount",
        width: 110,
        align: "right" as const,
        renderer: ({ value }: any) =>
          `<span class="font-mono tabular-nums font-semibold text-neutral-900 text-xs">${value}</span>`,
      },
      {
        text: "Status",
        field: "statusLabel",
        width: 140,
        renderer: ({ record }: any) => {
          const status = record.status;
          const label = record.statusLabel;
          let badgeCls = "bg-neutral-100 text-neutral-700 border-neutral-200";
          if (status === "FUNDS_HELD") badgeCls = "bg-saffron-300 text-neutral-950 border-saffron-400";
          else if (status === "SHIPPED") badgeCls = "bg-info-50 text-info-700 border-info-200";
          else if (status === "DELIVERED" || status === "RELEASED") badgeCls = "bg-success-50 text-success-700 border-success-200";
          else if (status === "REFUNDED") badgeCls = "bg-info-50 text-info-700 border-info-200";
          else if (status === "CLAIM_OPEN" || status === "ESCALATED") badgeCls = "bg-danger-50 text-danger-700 border-danger-200";

          return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${badgeCls}">${label}</span>`;
        },
      },
    ],
    []
  );

  // Event Renderer returning clean, semantic HTML with Phosphor SVG icons and screen-reader labels
  const eventRenderer = useCallback(({ eventRecord, renderData }: any) => {
    const state = eventRecord.state || "upcoming";
    renderData.cls.add(`state-${state}`);

    if (eventRecord.isMilestone) {
      renderData.cls.add("referee-decision-marker");
      return `
        <div class="flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold select-none cursor-pointer" role="button" aria-label="${eventRecord.name}: ${eventRecord.shortRationale || ''}">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-saffron-400 shadow-xs shrink-0"></span>
          <span class="truncate text-neutral-950 font-bold">${eventRecord.action || "DECISION"}</span>
        </div>
      `;
    }

    const isShip = eventRecord.windowType === "ship";
    const isDelivery = eventRecord.windowType === "delivery";

    const iconSvg = isShip
      ? `<svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M223.68,66.15,135.68,18a16,16,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a16,16,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.68,16.24-80.32-44ZM120,47.78v88L40,91.79V58.21ZM40,105.79l80,44v88L40,193.79Zm96,132v-88l80-44v88Z"/></svg>`
      : isDelivery
      ? `<svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M246.86,110.15l-32-48A8,8,0,0,0,208.2,58H168V48a16,16,0,0,0-16-16H24A16,16,0,0,0,8,48V184a16,16,0,0,0,16,16H36a32,32,0,0,0,64,0h56a32,32,0,0,0,64,0h16a16,16,0,0,0,16-16V116A8,8,0,0,0,246.86,110.15ZM68,208a16,16,0,1,1,16-16A16,16,0,0,1,68,208Zm120,0a16,16,0,1,1,16-16A16,16,0,0,1,188,208ZM232,184H218.67A32,32,0,0,0,157.33,184H106.67A32,32,0,0,0,45.33,184H24V48H152V184h8V112h58.24l26.66,40V184Z"/></svg>`
      : `<svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/></svg>`;

    return `
      <div class="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium w-full h-full select-none cursor-pointer overflow-hidden" role="button" aria-label="${eventRecord.name} (${state}): click to open Deal Room">
        <span class="shrink-0 flex items-center justify-center">${iconSvg}</span>
        <span class="truncate font-sans font-medium text-[11px] sm:text-xs">${eventRecord.name}</span>
        <span class="ml-auto text-[9px] uppercase font-mono tracking-wider opacity-85 px-1 py-0.2 rounded-xs bg-black/15 shrink-0">${state}</span>
      </div>
    `;
  }, []);

  // Event Click Handler: opens the deal room
  const handleEventClick = useCallback(
    ({ eventRecord }: any) => {
      if (eventRecord?.dealId) {
        router.push(`/deal/${eventRecord.dealId}`);
      }
    },
    [router]
  );

  if (loading) {
    return (
      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="h-10 w-64 bg-neutral-100 rounded-sm animate-pulse" />
        <ScheduleBoardSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 max-w-xl mx-auto flex flex-col items-center justify-center text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-danger-50 text-danger-700 flex items-center justify-center">
          <Warning size={24} weight="bold" />
        </div>
        <h2 className="font-serif text-xl text-neutral-900">Fulfillment Board Unavailable</h2>
        <p className="text-xs text-neutral-600">{error || "Please sign in to view your schedule."}</p>
        <button
          onClick={() => fetchSchedule(true)}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-xs font-medium rounded-sm transition"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Toast Notification Banner (Step B) */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 max-w-md bg-neutral-950 text-white px-4 py-3 rounded-lg shadow-xl border border-neutral-700 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === "decision" ? (
              <Scales size={18} weight="fill" className="text-saffron-400" />
            ) : toast.type === "state_change" ? (
              <CheckCircle size={18} weight="fill" className="text-success-500" />
            ) : (
              <Sparkle size={18} weight="fill" className="text-primary-300" />
            )}
          </div>
          <div className="flex-1 text-xs">
            <p className="font-semibold text-white">{toast.title}</p>
            <p className="text-neutral-300 mt-0.5 leading-relaxed">{toast.body}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-neutral-400 hover:text-white p-1 rounded-sm transition"
            aria-label="Dismiss notification"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      )}

      {/* Top Header Row with Navigation Tabs (rendered only if not embedded inside SellerDashboard) */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl text-neutral-900 tracking-tight">
              Fulfillment Board
            </h1>
            <p className="text-xs text-neutral-600 mt-1">
              Real time fulfillment timeline, delivery milestones, and automated Referee policy decisions.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar & Live Sync Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3 sm:p-4 rounded-lg border border-neutral-200">
        {/* Left: View Presets & Grouping */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-neutral-100 p-0.5 rounded-sm border border-neutral-200">
            <button
              onClick={() => setViewPreset("weekAndDayLetter")}
              className={`px-2.5 py-1 text-xs font-medium rounded-xs transition ${
                viewPreset === "weekAndDayLetter"
                  ? "bg-surface text-neutral-900 shadow-xs font-semibold"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Week View
            </button>
            <button
              onClick={() => setViewPreset("dayAndWeek")}
              className={`px-2.5 py-1 text-xs font-medium rounded-xs transition ${
                viewPreset === "dayAndWeek"
                  ? "bg-surface text-neutral-900 shadow-xs font-semibold"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Day View
            </button>
          </div>

          <button
            onClick={() => setIsGrouped(!isGrouped)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-medium transition ${
              isGrouped
                ? "bg-primary-50 border-primary-300 text-primary-800"
                : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <Rows size={14} weight={isGrouped ? "bold" : "regular"} />
            <span>{isGrouped ? "Grouped by status" : "Group by status"}</span>
          </button>

          <button
            onClick={() => fetchSchedule(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 transition disabled:opacity-50"
          >
            <ArrowsClockwise size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>

        {/* Right: Live Sync Badge & Demo Action */}
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-success-50 text-success-700 border border-success-200"
            role="status"
          >
            <span className="w-2 h-2 rounded-full bg-success-600 animate-pulse" />
            <span>Live Sync (10s)</span>
          </div>

          <button
            onClick={handleTriggerDemoDecision}
            disabled={demoTriggering}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-saffron-300 hover:bg-saffron-400 active:bg-saffron-700 text-neutral-950 border border-saffron-400/80 rounded-sm text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            <Sparkle size={14} weight="fill" />
            <span>{demoTriggering ? "Simulating..." : "Test Sweep Reaction"}</span>
          </button>
        </div>
      </div>

      {/* Legend Row */}
      <div className="flex items-center gap-4 text-xs text-neutral-600 overflow-x-auto py-1">
        <span className="font-medium text-neutral-800 shrink-0">Legend:</span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-xs bg-[#0F5C4D]" />
          <span>Active Window</span>
        </span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-xs bg-[#047E39]" />
          <span>Completed</span>
        </span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-xs bg-[#EFF6F3] border border-[#D0D8D5]" />
          <span>Upcoming</span>
        </span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-xs bg-[#AF3C3A]" />
          <span>Overdue</span>
        </span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-full bg-[#FFD988] border border-[#F2A81D]" />
          <span>Referee Decision Marker</span>
        </span>
      </div>

      {/* Bryntum Scheduler Container / Empty State */}
      {data.resources.length === 0 ? (
        <div className="w-full py-16 bg-surface rounded-lg border border-neutral-200 text-center flex flex-col items-center justify-center p-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
            <Package size={24} weight="regular" />
          </div>
          <h3 className="font-serif text-lg text-neutral-900">No active deals yet</h3>
          <p className="text-xs text-neutral-600 max-w-sm">
            When buyers commit to an escrow deal, your fulfillment deadlines and automated carrier checkpoints will appear on this schedule.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-primary-700 hover:bg-primary-800 text-white text-xs font-medium transition shadow-xs focus-visible:outline-2 focus-visible:outline-focus-ring"
          >
            <Plus size={14} weight="bold" />
            <span>Create a new deal</span>
          </button>
        </div>
      ) : (
        <div className="w-full h-[620px] bg-surface rounded-lg border border-neutral-200 shadow-xs overflow-hidden">
          <BryntumScheduler
            resources={data.resources}
            events={data.events}
            timeRanges={data.timeRanges}
            columns={columns}
            startDate={timelineBounds.start}
            endDate={timelineBounds.end}
            viewPreset={viewPreset}
            rowHeight={64}
            barMargin={6}
            eventLayout="stack"
            readOnly={true}
            eventRenderer={eventRenderer}
            onEventClick={handleEventClick}
            groupFeature={isGrouped ? { field: "statusLabel" } : false}
            timeRangesFeature={true}
            eventTooltipFeature={{
              template: (eventData: any) => {
                const e = eventData.eventRecord;
                if (e.isMilestone) {
                  return `
                    <div class="p-3 text-xs space-y-1.5 max-w-xs font-sans">
                      <div class="flex items-center gap-1.5 font-bold text-saffron-300">
                        <span>Referee Decision: ${e.action || "DECISION"}</span>
                      </div>
                      <p class="text-neutral-200 text-xs leading-relaxed">${e.shortRationale || ""}</p>
                      ${e.clauseRefs && e.clauseRefs.length > 0 ? `<div class="text-[11px] text-neutral-400">Cited Clauses: ${e.clauseRefs.join(", ")}</div>` : ""}
                      ${e.evidenceRefs && e.evidenceRefs.length > 0 ? `<div class="text-[11px] text-neutral-400">Cited Evidence: ${e.evidenceRefs.join(", ")}</div>` : ""}
                      <div class="pt-1.5 text-[11px] text-primary-300 font-semibold border-t border-neutral-800">Click marker to open Deal Room</div>
                    </div>
                  `;
                }
                return `
                  <div class="p-3 text-xs space-y-1 max-w-xs font-sans">
                    <div class="font-bold text-white text-xs">${e.name} (${e.state})</div>
                    <div class="text-neutral-300 text-[11px]">Window: ${new Date(e.startDate).toLocaleDateString()} to ${new Date(e.endDate).toLocaleDateString()}</div>
                    <div class="pt-1.5 text-[11px] text-primary-300 font-semibold border-t border-neutral-800">Click bar to open Deal Room</div>
                  </div>
                `;
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
