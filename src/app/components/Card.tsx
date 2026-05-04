import { type ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  tone?: "default" | "soft";
};

export function Card({ children, tone = "default" }: CardProps) {
  return <section className={`card ${tone}`}>{children}</section>;
}
