import React, { useId } from "react";
import * as RadixRadioGroup from "@radix-ui/react-radio-group";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

export interface RadioGroupProps {
  label?: string;
  value: string;
  onValueChange: (val: string) => void;
  options: RadioOption[];
  variant?: "standard" | "card";
  disabled?: boolean;
  className?: string;
}

export function RadioGroup({
  label,
  value,
  onValueChange,
  options,
  variant = "standard",
  disabled = false,
  className = "",
}: RadioGroupProps) {
  const generatedId = useId();

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      {label && (
        <span className="text-sm font-medium text-neutral-900 select-none">
          {label}
        </span>
      )}

      <RadixRadioGroup.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        className={variant === "card" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}
      >
        {options.map((opt) => {
          const optId = `${generatedId}-${opt.value}`;

          if (variant === "card") {
            const isSelected = value === opt.value;
            return (
              <label
                key={opt.value}
                htmlFor={optId}
                className={`flex items-center gap-3 p-3 rounded-sm border cursor-pointer select-none transition-colors ${
                  isSelected
                    ? "bg-primary-50/50 border-primary-700"
                    : "bg-white border-neutral-300 hover:border-neutral-500"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <RadixRadioGroup.Item
                  id={optId}
                  value={opt.value}
                  className="h-5 w-5 rounded-full border border-neutral-500 bg-white flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 data-[state=checked]:border-primary-700 shrink-0"
                >
                  <RadixRadioGroup.Indicator className="flex items-center justify-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary-700" />
                  </RadixRadioGroup.Indicator>
                </RadixRadioGroup.Item>

                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-900 leading-tight">
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span className="text-xs text-neutral-600 mt-0.5">
                      {opt.description}
                    </span>
                  )}
                </div>
              </label>
            );
          }

          return (
            <div key={opt.value} className="flex items-center gap-3 min-h-[44px] cursor-pointer select-none">
              <RadixRadioGroup.Item
                id={optId}
                value={opt.value}
                className="h-5 w-5 rounded-full border border-neutral-500 bg-white flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 data-[state=checked]:border-primary-700 shrink-0 cursor-pointer"
              >
                <RadixRadioGroup.Indicator className="flex items-center justify-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary-700" />
                </RadixRadioGroup.Indicator>
              </RadixRadioGroup.Item>

              <label htmlFor={optId} className={`flex flex-col cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
                <span className="text-sm font-medium text-neutral-900 leading-tight">
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="text-xs text-neutral-600 mt-0.5">
                    {opt.description}
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </RadixRadioGroup.Root>
    </div>
  );
}

