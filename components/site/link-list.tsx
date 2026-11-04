type Link = { service: string; label: string; href: string };

/**
 * Where else to find me, each service's name as a label beside its link.
 */
export function LinkList({ links }: { links: readonly Link[] }) {
  return (
    <ul data-slot="link-list">
      {links.map(({ service, label, href }) => (
        <li key={href} className="flex items-baseline gap-3">
          <span className="role-mono-sm text-ramp-7 w-18 shrink-0">
            {service}
          </span>
          <a
            href={href}
            className="role-body text-link underline decoration-1 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}
