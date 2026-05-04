import { type ButtonHTMLAttributes, type ReactNode } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
};

export function PrimaryButton({
  children,
  variant = "primary",
  ...buttonProps
}: PrimaryButtonProps) {
  return (
    <button className={`button ${variant}`} {...buttonProps}>
      {children}
    </button>
  );
}
