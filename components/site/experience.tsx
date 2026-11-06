type Role = {
  /** "Jul 2025", or a year alone when the month isn't on the resume. */
  from: string;
  /** The end, or "Present". Leave it out for a role inside one year. */
  to?: string;
  company: string;
  title: string;
  points?: readonly string[];
};

/**
 * Work history as the resume's date rail: each role's dates in a TX-02 rail
 * on the left, then its company, title and points. Newest first, as on the
 * resume. Each company is an h3, so the roles sit under the section's h2.
 *
 * One row shape at every width, top-aligned like the Timeline: the rail's
 * 16px label lines pad 5px above and below to sit on the 26px body lines,
 * and a range breaks after its hyphen, as the resume sets it.
 */
export function Experience({ roles }: { roles: readonly Role[] }) {
  return (
    <ol data-slot="experience" className="flex flex-col gap-8">
      {roles.map((role) => (
        <li key={`${role.company} ${role.from}`} className="flex gap-3">
          <p className="role-mono-sm text-ramp-7 desktop:w-20 w-18 shrink-0 py-1.25">
            {role.to ? (
              <>
                {role.from} -<br />
                {role.to}
              </>
            ) : (
              role.from
            )}
          </p>
          <div className="flex-1">
            <h3 className="role-body text-ramp-10 font-semibold">
              {role.company}
            </h3>
            <p className="role-body text-ramp-7">{role.title}</p>
            {role.points && (
              <ul className="role-body text-ramp-8 marker:text-ramp-6 mt-2 flex list-disc flex-col gap-2 pl-5">
                {role.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
