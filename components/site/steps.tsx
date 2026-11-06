import { useId } from "react";
import { Meta } from "@/components/site/page-header";

type Step = { step: string; detail: string };

/**
 * A process in order, under its label as a meta line. From 1200px up the
 * steps run left to right in equal columns under one hairline, as a stat
 * row's cells do; below, they stack as rows under a hairline, each name in
 * a 104 slot beside its detail. The ordinals repeat the list's own order,
 * so assistive tech skips them.
 */
export function Steps({
  label,
  steps,
}: {
  label: string;
  steps: readonly Step[];
}) {
  const labelId = useId();
  return (
    <div data-slot="steps" className="desktop:gap-3 flex flex-col gap-2">
      <div className="max-desktop:border-ramp-4 max-desktop:border-b max-desktop:pb-3">
        <Meta id={labelId}>{label}</Meta>
      </div>
      <ol
        aria-labelledby={labelId}
        className="desktop:grid desktop:auto-cols-fr desktop:grid-flow-col desktop:gap-0 flex flex-col gap-2"
      >
        {steps.map(({ step, detail }, index) => (
          <li
            key={step}
            className="desktop:flex-col desktop:items-stretch desktop:gap-1.5 desktop:border-t desktop:border-ramp-4 desktop:pt-3 desktop:not-last:pr-5 flex items-baseline gap-3"
          >
            <span className="role-step desktop:w-auto flex w-26 shrink-0 gap-2.5">
              <span aria-hidden className="text-ramp-7">
                {index + 1}
              </span>
              <span className="text-ramp-10 font-medium">{step}</span>
            </span>
            <span className="role-detail text-ramp-8">{detail}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
