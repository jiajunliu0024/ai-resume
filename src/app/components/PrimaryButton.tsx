import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
  /** Shows spinner and sets aria-busy; use with disabled while work runs. */
  loading?: boolean;
};

export function PrimaryButton({
  children,
  variant = "primary",
  loading = false,
  disabled,
  ...buttonProps
}: PrimaryButtonProps) {
  return (
    <button
      className={`button ${variant}${loading ? " button--loading" : ""}`}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...buttonProps}
    >
      {loading ? <LoadingSpinner size="sm" /> : null}
      <span className="button-label">{children}</span>
    </button>
  );
}
