import { cn } from "@/lib/utils";

type Entry = {
  /** MM-DD. */
  date: string;
  text: string;
  /** The date is a guess: dashed marker, no rail. */
  inferred?: true;
  /** A repo name at the right end of the row. */
  tag?: string;
};

type Year = { year: number; entries: readonly Entry[] };

const marker = {
  lit: "bg-signal shadow-lit-marker",
  idle: "bg-ramp-6 dark:bg-ramp-7",
  inferred:
    "outline outline-ramp-7 -outline-offset-1 outline-dashed dark:outline-ramp-8",
} as const;

/**
 * Years oldest first. The first entry and the latest one are lit, so adding
 * a newer entry moves the latest highlight with no other edit.
 *
 * One row shape at every width: top-aligned, 6px block padding and 20px
 * lines (the 16px labels pad 2px above and below), so a one-line row is 32
 * tall and a wrapped row keeps its date and marker on the first line. The
 * rail shows at 1100px and up, and breaks at year rows and inferred rows.
 */
export function Timeline({ years }: { years: readonly Year[] }) {
  const lit = new Set([years[0]?.entries[0], years.at(-1)?.entries.at(-1)]);
  const markerOf = (entry: Entry): keyof typeof marker => {
    if (entry.inferred) return "inferred";
    return lit.has(entry) ? "lit" : "idle";
  };

  return (
    <section data-slot="timeline">
      <div
        data-slot="timeline-header"
        className="flex items-baseline justify-between"
      >
        <h2 className="role-heading text-ramp-10">Timeline</h2>
        <p className="flex items-baseline gap-2">
          <span
            aria-hidden
            className="border-ramp-6 w-3.5 self-center border-t border-dashed"
          />
          <span className="role-mono-sm text-ramp-6">inferred</span>
        </p>
      </div>
      {years.map(({ year, entries }) => (
        <section key={year}>
          <h3 className="role-readout h-row text-signal-dim flex items-end pb-1">
            {year}
          </h3>
          <ol>
            {entries.map((entry) => (
              <li key={entry.date} className="flex gap-3 py-1.5">
                <time
                  dateTime={`${year}-${entry.date}`}
                  className="role-mono-sm text-ramp-6 desktop:w-12 w-10 shrink-0 py-0.5"
                >
                  {entry.date}
                </time>
                <span aria-hidden className="relative w-1.75 shrink-0 pt-1.75">
                  {!entry.inferred && (
                    <span className="bg-ramp-4 max-desktop:hidden absolute -inset-y-1.5 left-0.75 w-px" />
                  )}
                  <span
                    className={cn(
                      "relative block size-1.75",
                      marker[markerOf(entry)]
                    )}
                  />
                </span>
                <span className="role-entry text-ramp-9 flex-1">
                  {entry.text}
                </span>
                {entry.tag && (
                  <span className="role-mono-sm text-signal-dim w-max py-0.5">
                    {entry.tag}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </section>
  );
}
