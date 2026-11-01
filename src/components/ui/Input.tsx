import React, { forwardRef, useId } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  iconPrefix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    iconPrefix,
    id: explicitId,
    disabled,
    className = "",
    ...props
  },
  ref
) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-neutral-900 select-none">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {iconPrefix && (
          <span className="absolute left-3 flex items-center justify-center text-neutral-500 pointer-events-none" aria-hidden="true">
            {iconPrefix}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`h-11 w-full bg-white text-neutral-900 placeholder:text-neutral-500 rounded-sm text-sm border transition-colors ${
            iconPrefix ? "pl-9 pr-3" : "px-3"
          } ${
            error
              ? "border-danger-600 focus-visible:outline-danger-600"
              : "border-neutral-500 hover:border-neutral-700 focus-visible:outline-focus-ring"
          } focus-visible:outline-2 focus-visible:outline-offset-2 disabled:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          {...props}
        />
      </div>

      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-xs text-danger-600 font-medium" role="alert">
          <WarningCircle size={14} weight="bold" aria-hidden="true" className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-neutral-600">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

