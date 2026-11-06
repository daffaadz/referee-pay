"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import type { DealGanttData, GanttTask } from "@/domain/gantt";
import { Clock, ShieldCheck, WarningCircle, CheckCircle, Info } from "@phosphor-icons/react/dist/ssr";
import "@/styles/bryntum-gantt.css";

// Skeleton fallback while Bryntum Gantt loads client-side
function GanttSkeleton() {
  return (
    <div className="w-full h-[360px] bg-neutral-50 rounded-lg border border-neutral-200 flex flex-col justify-center items-center gap-3 p-6 animate-pulse">
      <div className="h-4 w-48 bg-neutral-200 rounded" />
      <div className="h-3 w-64 bg-neutral-200 rounded" />
      <div className="w-full max-w-md h-24 bg-neutral-100 rounded mt-4 border border-neutral-200" />
      <span className="text-xs text-neutral-500 font-medium mt-2">
        Loading Bryntum Gantt cascade...
      </span>
    </div>
  );
}

// Dynamically import BryntumGantt with ssr: false
const BryntumGantt = dynamic(
  () =>
    import("@bryntum/gantt-react").then((mod) => mod.BryntumGantt),
  {
    ssr: false,
    loading: () => <GanttSkeleton />,
  }
);

interface DealGanttViewProps {
  data: DealGanttData;
}

export function DealGanttView({ data }: DealGanttViewProps) {
  const hasLateTask = useMemo(
    () => data.tasks.some((t) => t.status === "late"),
    [data.tasks]
  );

  const lateTask = useMemo(
    () => data.tasks.find((t) => t.status === "late"),
    [data.tasks]
  );

  // Gantt configuration object
  const ganttConfig = useMemo(() => {
    return {
      readOnly: true,
      rowHeight: 46,
      barMargin: 8,
      viewPreset: "dayAndWeek",
      startDate: data.projectStartDate,
      endDate: data.projectEndDate,
      features: {
        baselines: {
          disabled: false,
        },
        dependencies: {
          disabled: false,
        },
        taskTooltip: {
          template: ({ taskRecord }: { taskRecord: any }) => {
            const task = taskRecord.originalData as GanttTask;
            const baselines = task.baselines || [];
            const baseline = baselines[0];

            return `
              <div class="p-3 text-xs space-y-1.5 max-w-xs font-sans">
                <div class="font-semibold text-neutral-900 border-b border-neutral-700 pb-1 flex items-center justify-between">
                  <span>${task.name}</span>
                  <span class="text-[11px] font-mono">${task.statusLabel}</span>
                </div>
                <div class="text-neutral-300">
                  <strong>Progress:</strong> ${task.percentDone}%
                </div>
                <div class="text-neutral-300">
                  <strong>Actual Window:</strong> ${task.startDate.slice(0, 10)} to ${task.endDate.slice(0, 10)} (${task.duration} days)
                </div>
                ${
                  baseline
                    ? `<div class="text-saffron-300">
                        <strong>Planned Baseline:</strong> ${baseline.startDate.slice(0, 10)} to ${baseline.endDate.slice(0, 10)} (${baseline.duration} days)
                      </div>`
                    : ""
                }
                ${
                  task.note
                    ? `<div class="text-neutral-400 text-[11px] pt-1 border-t border-neutral-800">
                        ${task.note}
                      </div>`
                    : ""
                }
              </div>
            `;
          },
        },
      },
      columns: [
        {
          field: "name",
          text: "Task Step",
          width: 210,
        },
        {
          field: "status",
          text: "Status",
          width: 140,
          renderer: ({ record }: { record: any }) => {
            const status = record.status as GanttTask["status"];
            const label = record.statusLabel as string;

            let badgeClass = "bg-neutral-100 text-neutral-700 border-neutral-300";
            if (status === "completed") {
              badgeClass = "bg-primary-50 text-primary-800 border-primary-200";
            } else if (status === "in_progress") {
              badgeClass = "bg-primary-100 text-primary-900 border-primary-300";
            } else if (status === "late") {
              badgeClass = "bg-danger-50 text-danger-800 border-danger-200 font-semibold";
            } else if (status === "refunded") {
              badgeClass = "bg-neutral-100 text-neutral-800 border-neutral-300";
            }

            return {
              tag: "span",
              className: `inline-flex items-center px-2 py-0.5 rounded text-[11px] border font-medium ${badgeClass}`,
              text: label,
            };
          },
        },
        {
          field: "duration",
          text: "Days",
          width: 75,
          align: "right" as const,
        },
      ] as any,
    };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Late step alert banner if blocking */}
      {hasLateTask && lateTask && (
        <div className="flex items-start gap-2.5 p-3 rounded-md bg-danger-50 border border-danger-200 text-xs text-danger-900">
          <WarningCircle size={16} weight="bold" className="text-danger-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold text-danger-900">Fulfillment Delayed: </strong>
            <span>
              {lateTask.name} is currently overdue ({lateTask.statusLabel}). Subsequent tasks are blocked until this requirement is fulfilled or resolved by Referee.
            </span>
          </div>
        </div>
      )}

      {/* Main Gantt Canvas */}
      <div className="w-full h-[380px] rounded-lg border border-neutral-200 overflow-hidden shadow-xs b-gantt-wrapper">
        <BryntumGantt
          {...ganttConfig}
          tasks={data.tasks}
          dependencies={data.dependencies}
        />
      </div>

      {/* Legend & Planned vs Actual Explanation */}
      <div className="p-3 bg-neutral-50 rounded-md border border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-700 font-sans">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-primary-700 inline-block" />
            <span>Actual / In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#047E39] inline-block" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-danger-700 inline-block" />
            <span>Overdue (Late)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 border border-dashed border-saffron-500 bg-saffron-200 inline-block" />
            <span>Planned Baseline (Contract Terms)</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-neutral-500">
          <Info size={14} className="shrink-0 text-neutral-600" />
          <span>Bryntum Gantt cascades 5 contractual stages with dependency enforcement.</span>
        </div>
      </div>
    </div>
  );
}
