import { cn } from "@/lib/utils";

type Entry = {
  /**
   * MM-DD, or MM when only the month is known. Unique within its year. Leave
   * it out when only the year is known, and mark the entry inferred.
   */
  date?: string;
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
 * A section of its own, with its heading and the legend at the right, then the
 * years, oldest first, 12 apart. A year is a TX-02 label above its entries,
 * in gray ink; the signal is only for the lit markers. The first entry and
 * the latest one are lit, so adding a newer entry moves the latest highlight
 * with no other edit. Its id is "timeline", so a page links to #timeline.
 *
 * One row shape at every width: top-aligned, 26px lines to match role-body
 * (the 16px labels pad 5px above and below), so a one-line row is 26 tall and
 * a wrapped row keeps its date and marker on the first line. The 7px marker
 * sits 9 down, its center half a pixel above the first line's. The rail
 * shows at 1200px and up, and breaks at year rows and inferred rows.
 */
export function Timeline({ years }: { years: readonly Year[] }) {
  const lit = new Set([years[0]?.entries[0], years.at(-1)?.entries.at(-1)]);
  const markerOf = (entry: Entry): keyof typeof marker => {
    if (entry.inferred) return "inferred";
    return lit.has(entry) ? "lit" : "idle";
  };

  return (
    <section data-slot="timeline" id="timeline">
      <div
        data-slot="timeline-header"
        className="flex items-center justify-between"
      >
        <h2 className="role-heading text-ramp-10">Timeline</h2>
        <p className="flex items-baseline gap-2">
          <span
            aria-hidden
            className="border-ramp-6 w-3.5 self-center border-t border-dashed"
          />
          <span className="role-mono-sm text-ramp-7">inferred</span>
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {years.map(({ year, entries }) => (
          <section key={year}>
            <h3 className="role-mono-sm text-ramp-9 py-1.25 font-medium">
              {year}
            </h3>
            <ol>
              {entries.map((entry) => (
                <li key={entry.date ?? entry.text} className="flex gap-3">
                  <time
                    dateTime={entry.date ? `${year}-${entry.date}` : `${year}`}
                    className="role-mono-sm text-ramp-7 desktop:w-12 w-10 shrink-0 py-1.25"
                  >
                    {entry.date}
                  </time>
                  <span
                    aria-hidden
                    className="relative w-1.75 shrink-0 pt-2.25"
                  >
                    {!entry.inferred && (
                      <span className="bg-ramp-4 max-desktop:hidden absolute inset-y-0 left-0.75 w-px" />
                    )}
                    <span
                      className={cn(
                        "relative block size-1.75",
                        marker[markerOf(entry)]
                      )}
                    />
                  </span>
                  <span className="role-body text-ramp-9 flex-1">
                    {entry.text}
                  </span>
                  {entry.tag && (
                    <span className="role-mono-sm text-ramp-7 w-max py-1.25">
                      {entry.tag}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}
