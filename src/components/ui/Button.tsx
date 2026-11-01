import React, { forwardRef } from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "sm";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "default",
    loading = false,
    icon,
    disabled,
    children,
    className = "",
    ...props
  },
  ref
) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium transition-colors select-none focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses =
    size === "sm"
      ? "h-9 px-3 gap-1.5 text-xs rounded-sm"
      : "h-11 px-4 gap-2 text-sm rounded-sm";

  const variantClasses = {
    primary: "bg-primary-700 hover:bg-primary-800 text-white active:bg-primary-900",
    secondary: "bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-500 active:bg-neutral-100",
    ghost: "bg-transparent hover:bg-primary-50 text-primary-700 active:bg-primary-100",
  }[variant];

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <span
          className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      ) : (
        icon && <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
});

