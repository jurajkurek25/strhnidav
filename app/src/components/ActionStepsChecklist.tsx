"use client";

import { useState } from "react";

interface Step {
  id: string;
  body: string;
}

export function ActionStepsChecklist({
  steps,
  initialCompletedIds,
}: {
  steps: Step[];
  initialCompletedIds: string[];
}) {
  const [completed, setCompleted] = useState(new Set(initialCompletedIds));
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(stepId: string) {
    const isCompleted = completed.has(stepId);
    setPending(stepId);

    const next = new Set(completed);
    if (isCompleted) next.delete(stepId);
    else next.add(stepId);
    setCompleted(next);

    try {
      const res = await fetch("/api/progress/action-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionStepId: stepId, completed: !isCompleted }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // revert on failure
      const reverted = new Set(next);
      if (isCompleted) reverted.add(stepId);
      else reverted.delete(stepId);
      setCompleted(reverted);
    } finally {
      setPending(null);
    }
  }

  if (steps.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3.5">
      {steps.map((step) => {
        const isDone = completed.has(step.id);
        return (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => toggle(step.id)}
              disabled={pending === step.id}
              className="flex w-full items-start gap-4 text-left text-sm text-cream disabled:opacity-60"
            >
              <span
                className={`mt-1.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-sm border ${
                  isDone ? "border-gold bg-gold text-bg" : "border-gold"
                }`}
              >
                {isDone && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={isDone ? "text-muted line-through" : ""}>{step.body}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
