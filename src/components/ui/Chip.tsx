import React from "react";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  selected?: boolean;
}

export function Chip({
  icon,
  selected = false,
  children,
  className = "",
  disabled = false,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`h-9 px-3.5 rounded-full border text-sm font-medium inline-flex items-center gap-2 transition-colors select-none focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 ${
        selected
          ? "bg-primary-50 border-primary-700 text-primary-900"
          : "bg-white border-neutral-300 text-neutral-800 hover:bg-primary-50 hover:border-primary-300 active:bg-primary-100"
      } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {icon && <span className="text-neutral-600 flex items-center shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

