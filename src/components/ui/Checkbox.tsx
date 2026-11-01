import React, { useId } from "react";
import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check } from "@phosphor-icons/react/dist/ssr";

export interface CheckboxProps {
  label: string;
  helperText?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Checkbox({
  label,
  helperText,
  checked,
  onCheckedChange,
  disabled = false,
  id: explicitId,
  className = "",
}: CheckboxProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;

  return (
    <div className={`flex items-start gap-3 min-h-[44px] py-1 cursor-pointer select-none ${className}`}>
      <RadixCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(val) => onCheckedChange(val === true)}
        disabled={disabled}
        className="h-5 w-5 rounded-[6px] border border-neutral-500 bg-white flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 data-[state=checked]:bg-primary-700 data-[state=checked]:border-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 mt-0.5 cursor-pointer"
      >
        <RadixCheckbox.Indicator className="text-white flex items-center justify-center">
          <Check size={14} weight="bold" />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>

      <label
        htmlFor={id}
        className={`flex flex-col cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span className="text-sm font-medium text-neutral-900 leading-tight">{label}</span>
        {helperText && <span className="text-xs text-neutral-600 mt-1">{helperText}</span>}
      </label>
    </div>
  );
}

