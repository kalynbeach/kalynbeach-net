type Stat = {
  label: string;
  /** Label below 1200px, where the cell is narrower. */
  short?: string;
  value: string;
};

/**
 * A row of figures, a page's facts, in equal columns whose top borders join
 * into one hairline, each cell's text on its column's left edge.
 */
export function Stats({ items }: { items: readonly Stat[] }) {
  return (
    <dl
      data-slot="stats"
      className="@container grid auto-cols-fr grid-flow-col"
    >
      {items.map((stat) => (
        <div
          key={stat.label}
          className="border-ramp-4 desktop:not-last:pr-5 flex flex-col gap-1.5 border-t pt-3 not-last:pr-3"
        >
          <dt className="role-mono-sm text-ramp-7">
            {stat.short ? (
              <>
                <span className="max-desktop:hidden">{stat.label}</span>
                <span className="desktop:hidden">{stat.short}</span>
              </>
            ) : (
              stat.label
            )}
          </dt>
          <dd className="role-stat-value text-ramp-10">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
