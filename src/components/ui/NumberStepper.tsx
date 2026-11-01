import React, { forwardRef, useId, useRef, useCallback } from "react";
import { Minus, Plus, WarningCircle } from "@phosphor-icons/react/dist/ssr";

export interface NumberStepperProps {
  label?: string;
  helperText?: string;
  error?: string;
  unitSuffix?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (val: number) => void;
  id?: string;
  className?: string;
}

export const NumberStepper = forwardRef<HTMLInputElement, NumberStepperProps>(function NumberStepper(
  {
    label,
    helperText,
    error,
    unitSuffix = "days",
    value,
    min = 1,
    max = 60,
    step = 1,
    disabled = false,
    onChange,
    id: explicitId,
    className = "",
  },
  ref
) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clamp = useCallback(
    (val: number) => Math.min(Math.max(val, min), max),
    [min, max]
  );

  const handleDecrement = useCallback(() => {
    if (disabled || value <= min) return;
    onChange(clamp(value - step));
  }, [disabled, value, min, step, clamp, onChange]);

  const handleIncrement = useCallback(() => {
    if (disabled || value >= max) return;
    onChange(clamp(value + step));
  }, [disabled, value, max, step, clamp, onChange]);

  const startHold = (action: () => void) => {
    action();
    timerRef.current = setTimeout(() => {
      const interval = setInterval(action, 80);
      timerRef.current = interval as unknown as NodeJS.Timeout;
    }, 400);
  };

  const stopHold = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      clearInterval(timerRef.current as unknown as number);
      timerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      handleDecrement();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange(min);
      return;
    }
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      onChange(clamp(num));
    }
  };

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-neutral-900 select-none">
          {label}
        </label>
      )}

      <div
        className={`flex items-center h-11 w-full bg-white rounded-sm border overflow-hidden transition-colors ${
          error
            ? "border-danger-600 focus-within:outline-2 focus-within:outline-danger-600 focus-within:outline-offset-2"
            : "border-neutral-500 hover:border-neutral-700 focus-within:outline-2 focus-within:outline-focus-ring focus-within:outline-offset-2"
        } ${disabled ? "opacity-50 cursor-not-allowed bg-neutral-100" : ""}`}
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || value <= min}
          onMouseDown={() => startHold(handleDecrement)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onClick={(e) => {
            e.preventDefault();
          }}
          aria-label={`Decrease ${label || unitSuffix}`}
          className="h-full w-11 flex items-center justify-center shrink-0 text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed border-r border-border transition-colors cursor-pointer"
        >
          <Minus size={16} weight="bold" aria-hidden="true" />
        </button>

        <div className="flex-1 flex items-center justify-center gap-1.5 px-2">
          <input
            ref={ref}
            id={id}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={disabled}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            aria-label={label || `${value} ${unitSuffix}`}
            className="w-10 text-center font-medium text-neutral-900 text-sm tabular-nums bg-transparent outline-none border-none p-0 focus:ring-0"
          />
          {unitSuffix && (
            <span className="text-sm text-neutral-600 select-none font-normal">
              {unitSuffix}
            </span>
          )}
        </div>

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || value >= max}
          onMouseDown={() => startHold(handleIncrement)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onClick={(e) => {
            e.preventDefault();
          }}
          aria-label={`Increase ${label || unitSuffix}`}
          className="h-full w-11 flex items-center justify-center shrink-0 text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed border-l border-border transition-colors cursor-pointer"
        >
          <Plus size={16} weight="bold" aria-hidden="true" />
        </button>
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

