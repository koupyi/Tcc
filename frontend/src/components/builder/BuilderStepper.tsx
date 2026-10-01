import { Check } from "lucide-react";

export interface BuilderStepDef {
  key: string;
  label: string;
}

interface BuilderStepperProps {
  steps: BuilderStepDef[];
  currentIndex: number;
  completed: Set<string>;
  onStepClick: (index: number) => void;
}

export function BuilderStepper({ steps, currentIndex, completed, onStepClick }: BuilderStepperProps) {
  return (
    <nav aria-label="Etapas do builder" className="w-full overflow-x-auto pb-2">
      <ol className="flex items-center gap-1 min-w-max sm:min-w-0 sm:flex-wrap">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const isDone = completed.has(step.key);
          return (
            <li key={step.key} className="flex items-center">
              <button
                type="button"
                onClick={() => onStepClick(i)}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {isDone && !isCurrent ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      isCurrent ? "bg-primary-foreground/20" : "bg-background/50"
                    }`}
                  >
                    {i + 1}
                  </span>
                )}
                {step.label}
              </button>
              {i < steps.length - 1 && <span className="mx-1 h-px w-3 bg-border shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
