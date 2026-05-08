import { useRef } from "react";
import { CSSTransition, SwitchTransition } from "react-transition-group";

const labels = ["Scan", "Resume", "Tailor", "Letter"];

type StepProgressProps = {
  currentStepIndex: number;
};

export function StepProgress({ currentStepIndex }: StepProgressProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  return (
    <section className="steps" aria-label="Progress">
      <div className="steps-transition-shell">
        <SwitchTransition mode="out-in">
          <CSSTransition
            nodeRef={stripRef}
            key={currentStepIndex}
            timeout={{ enter: 220, exit: 180 }}
            classNames="step-menu"
            unmountOnExit
            appear={false}
          >
            <div ref={stripRef} className="steps-strip">
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
            </div>
          </CSSTransition>
        </SwitchTransition>
      </div>
    </section>
  );
}
