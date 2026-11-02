"use client";

import React from "react";
import { PaypalLogo } from "@phosphor-icons/react/dist/ssr";

interface PayPalLoginButtonProps {
  size?: "default" | "sm";
  className?: string;
}

export function PayPalLoginButton({ size = "default", className = "" }: PayPalLoginButtonProps) {
  const isSm = size === "sm";

  return (
    <a
      href="/api/auth/paypal/login"
      className={`inline-flex items-center justify-center gap-2 rounded-sm bg-saffron-300 hover:bg-saffron-400 active:bg-saffron-700 text-neutral-950 border border-saffron-400/80 font-sans font-semibold transition-colors duration-150 select-none shadow-xs no-underline focus-visible:outline-2 focus-visible:outline-focus-ring ${
        isSm ? "h-9 px-3 text-xs" : "h-10 sm:h-11 px-4 text-xs sm:text-sm"
      } ${className}`}
      style={{
        color: "var(--color-neutral-950, #090f0d)",
        textDecoration: "none",
      }}
      aria-label="Continue with PayPal"
    >
      <PaypalLogo size={isSm ? 18 : 20} weight="fill" className="shrink-0 text-neutral-950" />
      <span className="truncate">Continue with PayPal</span>
    </a>
  );
}
