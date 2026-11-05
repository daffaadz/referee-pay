import React from "react";

export function ScheduleBoardSkeleton() {
  return (
    <div className="w-full h-full min-h-[500px] flex flex-col bg-surface border border-neutral-200 rounded-lg overflow-hidden animate-pulse">
      {/* Top toolbar skeleton */}
      <div className="h-14 border-b border-neutral-200 bg-neutral-50 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-neutral-200 rounded-sm" />
          <div className="h-8 w-28 bg-neutral-200 rounded-sm" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-36 bg-neutral-200 rounded-sm" />
        </div>
      </div>

      {/* Grid header skeleton */}
      <div className="h-10 border-b border-neutral-200 bg-neutral-100 flex items-center px-4">
        <div className="w-60 h-4 bg-neutral-300 rounded-sm" />
        <div className="w-28 h-4 bg-neutral-200 rounded-sm ml-6" />
        <div className="w-32 h-4 bg-neutral-200 rounded-sm ml-6" />
        <div className="flex-1 h-4 bg-neutral-200 rounded-sm ml-12" />
      </div>

      {/* Rows skeleton */}
      <div className="flex-1 p-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-neutral-50 border border-neutral-100 rounded-md flex items-center px-4 gap-4">
            <div className="w-56 space-y-1.5">
              <div className="h-4 w-40 bg-neutral-200 rounded-sm" />
              <div className="h-3 w-24 bg-neutral-100 rounded-sm" />
            </div>
            <div className="w-24 h-4 bg-neutral-200 rounded-sm" />
            <div className="w-28 h-6 bg-neutral-200 rounded-full" />
            <div className="flex-1 flex items-center gap-2">
              <div className="h-8 w-1/4 bg-primary-100/60 rounded-sm" />
              <div className="h-8 w-1/3 bg-neutral-200 rounded-sm" />
              <div className="h-8 w-1/5 bg-neutral-100 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

