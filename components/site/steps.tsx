import { hairlineCell } from "@/components/site/stats";

type Step = { step: string; detail: string };

/** A process in order, left to right, in hairline cells. `label` names the list for screen readers. */
export function Steps({
  label,
  steps,
}: {
  label: string;
  steps: readonly Step[];
}) {
  return (
    <ol data-slot="steps" aria-label={label} className="flex">
      {steps.map(({ step, detail }) => (
        <li key={step} className={hairlineCell}>
          <span className="role-nav text-ramp-10">{step}</span>
          <span className="role-mono-sm text-ramp-6">{detail}</span>
        </li>
      ))}
    </ol>
  );
}
