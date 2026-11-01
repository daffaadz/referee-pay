import React, { forwardRef, useId, useEffect, useRef, useCallback } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  minRows?: number;
  maxRows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    helperText,
    error,
    minRows = 2,
    maxRows = 6,
    id: explicitId,
    disabled,
    className = "",
    onChange,
    value,
    ...props
  },
  forwardedRef
) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 24; // 16px font * 1.5 line-height = 24px
    const minHeight = minRows * lineHeight + 18;
    const maxHeight = maxRows * lineHeight + 18;
    const scrollHeight = el.scrollHeight;
    el.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
  }, [minRows, maxRows]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight();
    if (onChange) onChange(e);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-neutral-900 select-none">
          {label}
        </label>
      )}

      <textarea
        ref={(el) => {
          innerRef.current = el;
          if (typeof forwardedRef === "function") {
            forwardedRef(el);
          } else if (forwardedRef) {
            forwardedRef.current = el;
          }
        }}
        id={id}
        disabled={disabled}
        rows={minRows}
        value={value}
        onChange={handleChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        className={`w-full bg-white text-neutral-900 placeholder:text-neutral-500 rounded-sm text-sm p-3 border transition-colors resize-none ${
          error
            ? "border-danger-600 focus-visible:outline-danger-600"
            : "border-neutral-500 hover:border-neutral-700 focus-visible:outline-focus-ring"
        } focus-visible:outline-2 focus-visible:outline-offset-2 disabled:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
      />

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
