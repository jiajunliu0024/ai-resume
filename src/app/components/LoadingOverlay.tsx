import { type ReactNode } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

type LoadingOverlayProps = {
  active: boolean;
  label: string;
  detail?: string;
  children?: ReactNode;
  className?: string;
};

/** Covers a card or panel while async work runs; keeps layout from jumping. */
export function LoadingOverlay({
  active,
  label,
  detail,
  children,
  className = "",
}: LoadingOverlayProps) {
  return (
    <div
      className={`loading-overlay-host${active ? " is-waiting" : ""}${className ? ` ${className}` : ""}`}
      aria-busy={active}
    >
      {children}
      {active ? (
        <div className="loading-overlay" role="status" aria-live="polite">
          <LoadingSpinner size="lg" onLight />
          <p className="loading-overlay-label">{label}</p>
          {detail ? <p className="loading-overlay-detail">{detail}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
