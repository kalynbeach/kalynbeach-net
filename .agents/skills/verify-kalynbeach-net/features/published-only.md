# Published-only mode

Production serves only published pages and hides every `<Draft>` section. Vercel previews and dev serve everything. A visitor on production never sees an unpublished page's nav row, Cmd+K item, or content.

## Sub-features

- `pub-nav` leaves unpublished pages out of the `Site` navigation.
- `pub-palette` leaves them out of the Cmd+K palette.
- `pub-route` answers an unpublished page and its children with status 404 and `Not found`.
- `pub-draft` drops `<Draft>` sections, such as About's `Work` section, and their `Draft. Hidden on production.` marker.

## How to get to it (user POV)

- Visit the site on production. Locally, `verify launch --published-only` serves the same pages.
- Compare with `verify launch`, which serves what a preview shows.

## Driving it with verify browser

Preconditions:

- Baseline state from the [index](./README.md), launched with `verify launch --published-only`. `verify doctor` reports `mode published-only` and `GET /software is 404`.
- `lib/site.ts` as of this map: About and Sound are published, Software and its projects are not. Read `published` in `lib/site.ts` before asserting, since Kalyn flips these flags.

- **Nav.** Run `verify browser open "$VERIFY_URL/"`. The `Site` navigation holds `Home`, `About`, `Sound`, and no `Software`.
- **Palette.** Run `verify browser press Meta+k`. The `PAGES` group holds `Home`, `About`, `Sound`. `ADMIN` still holds `Dashboard` and `Lab`.
- **Route.** Run `curl -s -o /dev/null -w '%{http_code}\n'` against `$VERIFY_URL/software`, `$VERIFY_URL/software/agents`, and `$VERIFY_URL/software/kkb-audio`. Each prints `404`. `verify browser open "$VERIFY_URL/software"` shows the heading `Not found`.
- **Draft.** Run `verify browser open "$VERIFY_URL/about"`. `main` has the `Links` heading and no `Work` heading, and `verify browser get count '[data-slot=draft-start]'` returns `0`. In mode `all`, the same page has the `Work` heading and a count of `1`.
- **Proof.** Save the nav and palette snapshots, the `curl` lines, and the About snapshot under `$VERIFY_EVIDENCE/published-only/`, each labeled with `$VERIFY_MODE`. Capture the mode `all` About snapshot in a separate run for the comparison.

## Gotchas

- The mode is fixed at launch, because `next.config.ts` inlines `SITE_PUBLISHED_ONLY` into the bundles. Switch with `verify stop` and a new `verify launch`.
- `/tech` still redirects to `/software`, which then answers 404 in this mode. That matches production.
- This mode runs `next dev`, not a production build. `VERCEL_ENV=production bun run build` checks the build itself, and this map does not cover it.
