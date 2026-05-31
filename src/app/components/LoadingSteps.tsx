export type LoadingStepState = "pending" | "active" | "done";

export type LoadingStepItem = {
  id: string;
  label: string;
  state: LoadingStepState;
};

type LoadingStepsProps = {
  steps: LoadingStepItem[];
};

export function LoadingSteps({ steps }: LoadingStepsProps) {
  return (
    <ol className="loading-steps" aria-label="Progress">
      {steps.map((step) => (
        <li
          key={step.id}
          className={`loading-steps-item loading-steps-item--${step.state}`}
        >
          <span className="loading-steps-marker" aria-hidden="true">
            {step.state === "done" ? "✓" : step.state === "active" ? "…" : "○"}
          </span>
          <span className="loading-steps-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
