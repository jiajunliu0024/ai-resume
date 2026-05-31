type LoadingSpinnerProps = {
  /** Visual size; default fits buttons and overlays. */
  size?: "sm" | "md" | "lg";
  /** When true, spinner uses brand blue on light background (overlays). */
  onLight?: boolean;
};

const sizeClass: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "loading-spinner--sm",
  md: "loading-spinner--md",
  lg: "loading-spinner--lg",
};

export function LoadingSpinner({ size = "md", onLight = false }: LoadingSpinnerProps) {
  return (
    <span
      className={`loading-spinner ${sizeClass[size]}${onLight ? " loading-spinner--on-light" : ""}`}
      aria-hidden="true"
    />
  );
}
