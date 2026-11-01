import React from "react";
import {
  Hourglass,
  Lock,
  Truck,
  SealCheck,
  HandCoins,
  ArrowUUpLeft,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

export type DealStatusType =
  | "WAITING"
  | "HELD"
  | "SHIPPED"
  | "DELIVERED"
  | "RELEASED"
  | "REFUNDED"
  | "NEEDS_REVIEW"
  | "PROBLEM";

interface StatusConfig {
  label: string;
  icon: React.ComponentType<{ size: number; weight: "fill" | "regular" | "bold"; className?: string }>;
  classes: string;
}

const STATUS_CONFIGS: Record<DealStatusType, StatusConfig> = {
  WAITING: {
    label: "Waiting for payment",
    icon: Hourglass,
    classes: "bg-neutral-100 text-neutral-800 border-neutral-300",
  },
  HELD: {
    label: "Payment held",
    icon: Lock,
    classes: "bg-saffron-300 text-primary-950 border-saffron-400 font-semibold",
  },
  SHIPPED: {
    label: "Shipped",
    icon: Truck,
    classes: "bg-info-50 text-info-700 border-info-100",
  },
  DELIVERED: {
    label: "Delivered, review period open",
    icon: SealCheck,
    classes: "bg-success-50 text-success-700 border-success-100",
  },
  RELEASED: {
    label: "Released to seller",
    icon: HandCoins,
    classes: "bg-success-50 text-success-700 border-success-100",
  },
  REFUNDED: {
    label: "Refunded to buyer",
    icon: ArrowUUpLeft,
    classes: "bg-info-50 text-info-700 border-info-100",
  },
  NEEDS_REVIEW: {
    label: "Needs review",
    icon: Warning,
    classes: "bg-warning-50 text-warning-700 border-warning-100",
  },
  PROBLEM: {
    label: "Problem",
    icon: WarningCircle,
    classes: "bg-danger-50 text-danger-700 border-danger-100",
  },
};

export interface StatusChipProps {
  status: DealStatusType;
  customLabel?: string;
  className?: string;
}

export function StatusChip({ status, customLabel, className = "" }: StatusChipProps) {
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.WAITING;
  const IconComponent = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium border select-none ${config.classes} ${className}`}
      role="status"
    >
      <IconComponent size={14} weight="bold" className="shrink-0" />
      <span>{customLabel || config.label}</span>
    </div>
  );
}

