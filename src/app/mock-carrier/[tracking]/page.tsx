import React from "react";
import { getMockTracking, type MockCarrierStatus } from "@/integrations/kernel/mock-carrier-store";

export default async function MockCarrierPage({
  params,
}: {
  params: Promise<{ tracking: string }>;
}) {
  const { tracking } = await params;
  const data = getMockTracking(tracking);

  const getStatusBadge = (status: MockCarrierStatus) => {
    switch (status) {
      case "Delivered":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "Returned":
        return "bg-rose-50 text-rose-800 border-rose-200";
      case "In transit":
        return "bg-zinc-100 text-zinc-900 border-zinc-300";
      case "Label created":
      default:
        return "bg-zinc-100 text-zinc-700 border-zinc-200";
    }
  };

  const steps = ["Label created", "In transit", "Delivered"];
  const isReturned = data.status === "Returned";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 p-4 sm:p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Banner */}
        <div className="rounded-xl bg-white border border-zinc-200 p-3 text-xs text-zinc-600 flex items-center justify-between shadow-xs">
          <span className="font-semibold text-zinc-800">Demo Carrier Tracking Portal</span>
          <span className="text-[11px] text-zinc-400">Referee Automated Escrow Verification</span>
        </div>

        {/* Carrier Header */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
            <div>
              <div id="carrier-name" className="text-xl font-bold tracking-tight text-zinc-900">
                {data.carrier}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">
                Tracking Number: <span id="tracking-number" className="font-medium text-zinc-800">{data.trackingNumber}</span>
              </div>
            </div>

            <div>
              <span
                id="tracking-status"
                data-status={data.status}
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border tracking-wide uppercase ${getStatusBadge(
                  data.status
                )}`}
              >
                {data.status}
              </span>
            </div>
          </div>

          {/* Stepper */}
          {!isReturned ? (
            <div className="py-4">
              <div className="grid grid-cols-3 gap-2">
                {steps.map((st, i) => {
                  const stepIndex = steps.indexOf(data.status);
                  const isPassed = i <= stepIndex;
                  return (
                    <div key={st} className="space-y-2">
                      <div
                        className={`h-1.5 rounded-full ${
                          isPassed ? "bg-zinc-900" : "bg-zinc-100"
                        }`}
                      />
                      <span
                        className={`text-xs font-medium block ${
                          isPassed ? "text-zinc-900" : "text-zinc-400"
                        }`}
                      >
                        {st}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium">
              Notice: Package was returned to sender.
            </div>
          )}

          {/* Activity Logs */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Tracking History
            </h3>
            <div className="divide-y divide-zinc-100 text-xs">
              {data.history.map((h, idx) => (
                <div key={idx} className="py-2.5 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-zinc-800">{h.status}</p>
                    <p className="text-zinc-400 text-[11px]">{h.location}</p>
                  </div>
                  <span className="text-zinc-400 text-[11px] whitespace-nowrap">
                    {new Date(h.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
