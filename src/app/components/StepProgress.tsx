const labels = ["Scan", "Resume", "Tailor", "Letter"];

type StepProgressProps = {
  currentStepIndex: number;
};

export function StepProgress({ currentStepIndex }: StepProgressProps) {
  return (
    <section className="steps" aria-label="Progress">
      <div className="step-dots">
        {labels.map((label, index) => {
          const state =
            index < currentStepIndex
              ? "done"
              : index === currentStepIndex
                ? "active"
                : "";

          return (
            <span
              key={label}
              className={`step-dot ${state}`}
              aria-label={label}
            />
          );
        })}
      </div>
      <div className="step-labels">
        {labels.map((label, index) => (
          <span
            key={label}
            className={index === currentStepIndex ? "active" : ""}
          >
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
