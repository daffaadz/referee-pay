import React, { useId } from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { CaretDown, Check, WarningCircle } from "@phosphor-icons/react/dist/ssr";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface SelectProps {
  label?: string;
  helperText?: string;
  error?: string;
  value: string;
  onValueChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Select({
  label,
  helperText,
  error,
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  id: explicitId,
  className = "",
}: SelectProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-neutral-900 select-none">
          {label}
        </label>
      )}

      <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`h-11 w-full bg-white text-neutral-900 rounded-sm text-sm px-3 border flex items-center justify-between transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
            error
              ? "border-danger-600 focus-visible:outline-danger-600"
              : "border-neutral-500 hover:border-neutral-700 focus-visible:outline-focus-ring"
          } disabled:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon className="text-neutral-500 flex items-center">
            <CaretDown size={16} weight="bold" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className="z-50 min-w-[var(--radix-select-trigger-width)] max-h-60 overflow-hidden bg-white rounded-md border border-border shadow-menu animate-in fade-in-80"
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((opt) => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className="h-11 px-3 rounded-sm flex items-center justify-between text-sm text-neutral-900 hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none cursor-pointer select-none transition-colors data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
                >
                  <RadixSelect.ItemText>
                    <span className="font-medium">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="ml-2 text-xs text-neutral-500">{opt.sublabel}</span>
                    )}
                  </RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="text-primary-700 flex items-center">
                    <Check size={16} weight="bold" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

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
}

