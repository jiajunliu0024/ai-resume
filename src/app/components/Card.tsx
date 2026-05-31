import { type ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  tone?: "default" | "soft";
  className?: string;
};

export function Card({ children, tone = "default", className }: CardProps) {
  return (
    <section className={`card ${tone}${className ? ` ${className}` : ""}`}>
      {children}
    </section>
  );
}
