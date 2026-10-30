type Stat = {
  label: string;
  /** Label below 1100px, where the cell is narrower. */
  short?: string;
  value: string;
};

/** A row of figures whose cells' top borders join into one hairline. */
export function Stats({ items }: { items: readonly Stat[] }) {
  return (
    <dl data-slot="stats" className="flex">
      {items.map((stat) => (
        <div
          key={stat.label}
          className="border-ramp-4 desktop:not-first:pl-5 flex flex-1 flex-col gap-2 border-t pt-2.75 pb-2 not-first:pl-3"
        >
          <dt className="role-mono-sm text-ramp-6">
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
