import React, { forwardRef, useId, useState } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";

export interface MoneyFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  helperText?: string;
  error?: string;
  currency?: string;
  value: string;
  onChange: (val: string) => void;
}

export const MoneyField = forwardRef<HTMLInputElement, MoneyFieldProps>(function MoneyField(
  {
    label,
    helperText,
    error,
    currency = "USD",
    value,
    onChange,
    id: explicitId,
    disabled,
    onBlur,
    className = "",
    ...props
  },
  ref
) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  const [displayValue, setDisplayValue] = useState<string>(value);

  React.useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits and a single decimal point
    if (/^\d*\.?\d*$/.test(raw)) {
      setDisplayValue(raw);
      onChange(raw);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (displayValue && !isNaN(Number(displayValue))) {
      const formatted = Number(displayValue).toFixed(2);
      setDisplayValue(formatted);
      onChange(formatted);
    }
    if (onBlur) onBlur(e);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-neutral-900 select-none">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <div className="absolute left-3 flex items-center text-xs font-semibold text-neutral-600 select-none pointer-events-none tracking-wide">
          {currency}
        </div>
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="0.00"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`h-11 w-full bg-white text-neutral-900 placeholder:text-neutral-500 rounded-sm text-sm tabular-nums pl-12 pr-3 border transition-colors ${
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

