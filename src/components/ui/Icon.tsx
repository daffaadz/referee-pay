import React from "react";

export interface IconProps {
  icon: React.ComponentType<{
    size: number;
    weight?: "regular" | "bold" | "fill";
    className?: string;
  }>;
  size?: 14 | 16 | 20 | 24 | 28;
  weight?: "regular" | "bold" | "fill";
  className?: string;
  "aria-label"?: string;
}

export function Icon({
  icon: IconComponent,
  size = 20,
  weight = "regular",
  className = "",
  "aria-label": ariaLabel,
}: IconProps) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      <IconComponent size={size} weight={weight} />
    </span>
  );
}

