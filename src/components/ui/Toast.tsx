import React, { useEffect } from "react";
import { CheckCircle, WarningCircle, Info, X } from "@phosphor-icons/react/dist/ssr";

export type ToastType = "success" | "error" | "info";

export interface ToastProps {
  type?: ToastType;
  message: string;
  onClose?: () => void;
  durationMs?: number;
  className?: string;
}

export function Toast({
  type = "info",
  message,
  onClose,
  durationMs = 5000,
  className = "",
}: ToastProps) {
  useEffect(() => {
    if (!durationMs || !onClose) return;
    const timer = setTimeout(() => {
      onClose();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onClose]);

  const icons = {
    success: <CheckCircle size={18} weight="bold" className="text-success-600 shrink-0" />,
    error: <WarningCircle size={18} weight="bold" className="text-danger-600 shrink-0" />,
    info: <Info size={18} weight="bold" className="text-info-600 shrink-0" />,
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 max-w-sm z-50 flex items-center justify-between gap-3 px-4 py-3 bg-white text-neutral-900 border border-neutral-300 rounded-sm shadow-menu animate-in fade-in slide-in-from-bottom-2 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icons[type]}
        <p className="text-sm font-medium text-neutral-900 truncate">{message}</p>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          className="text-neutral-500 hover:text-neutral-800 p-1 rounded-sm focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          <X size={14} weight="bold" />
        </button>
      )}
    </div>
  );
}

