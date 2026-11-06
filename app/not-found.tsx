import Link from "next/link";

/**
 * Renders inside the shell. An unknown pathname resolves to the site map's
 * not-found entry, so the shell draws the title; this is the body.
 */
export default function NotFound() {
  return (
    <p className="role-body text-ramp-8">
      Nothing lives at this address.{" "}
      <Link href="/" className="link-underline text-ramp-10 underline">
        Go home
      </Link>
    </p>
  );
}
