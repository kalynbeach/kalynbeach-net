type Step = { step: string; detail: string };

/** A process in order, left to right, in Stats' hairline cells. `label` names the list for screen readers. */
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
        <li
          key={step}
          className="border-ramp-4 desktop:not-first:pl-5 flex flex-1 flex-col gap-2 border-t pt-2.75 pb-2 not-first:pl-3"
        >
          <span className="role-nav text-ramp-10">{step}</span>
          <span className="role-stat-label text-ramp-6">{detail}</span>
        </li>
      ))}
    </ol>
  );
}
