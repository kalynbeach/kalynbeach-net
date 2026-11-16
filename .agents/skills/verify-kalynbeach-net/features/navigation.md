# Navigation

A visitor moves between pages with the sidebar's `Site` navigation or the Cmd+K command palette. Old URLs redirect to their new pages, and an unknown path shows the not-found page inside the shell.

## Sub-features

- `nav-sidebar` lists the served pages and opens each one.
- `nav-palette` opens with Cmd+K, filters as the visitor types, and opens the chosen page.
- `nav-redirects` sends `/tech`, `/tech/audio`, and `/sound/wave-player` to their pages.
- `nav-not-found` answers an unknown path with status 404 and the `Not found` heading.

## How to get to it (user POV)

- Choose a link in the `Site` navigation in the sidebar.
- Press Cmd+K on any page, type part of a page name, and press Enter.
- Open an old or mistyped URL.

## Driving it with verify browser

Preconditions:

- Baseline state from the [index](./README.md), launched with `verify launch` (mode `all`). [Published-only mode](./published-only.md) covers what changes in the other mode.

- **Sidebar.** Run `verify browser open "$VERIFY_URL/"`. The `Site` navigation holds links `Home`, `About`, `Software`, `Sound`. Run `verify browser find role link click --name "About"` and `verify browser wait --url "**/about"`. The page heading is `About`.
- **Open palette.** Run `verify browser press Meta+k`. A dialog named `Command Palette` opens with focus in its combobox. Its `Suggestions` listbox has group `PAGES` with options `Home`, `About`, `Software`, `Software / Agents`, `Software / kkb-audio`, `Sound`, and group `ADMIN` with `Dashboard` and `Lab`.
- **Filter and choose.** Run `verify browser keyboard type "kkb"`. The only option is `Software / kkb-audio`, selected. Run `verify browser press Enter` and `verify browser wait --url "**/software/kkb-audio"`. The page heading is `kkb-audio` and the dialog is gone.
- **Redirects.** Run `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$VERIFY_URL/tech"`. It prints `307 $VERIFY_URL/software`. `/tech/audio` and `/sound/wave-player` print `307 $VERIFY_URL/software/kkb-audio`.
- **Not found.** Run `curl -s -o /dev/null -w '%{http_code}\n' "$VERIFY_URL/software/no-such"`. It prints `404`. Run `verify browser open "$VERIFY_URL/software/no-such"` and `verify browser wait --text "Not found"`. The heading is `Not found` and the sidebar still shows.
- **Proof.** Save the palette snapshot (`verify browser snapshot -s '[role=dialog]'`) after opening and after filtering, a screenshot of the opened page, and the `curl` lines, under `$VERIFY_EVIDENCE/navigation/`.

## Gotchas

- The palette lists `Dashboard` and `Lab` for signed-out visitors too. Choosing one lands on `/login`, which the [sign-in gate](./sign-in-gate.md) covers.
- Type with `keyboard type` after the palette opens. `fill` on a ref from an earlier snapshot can miss, because the dialog re-renders.
- `/software/agents` logs a Next dev error about `params` outside `<Suspense>` in `next.log`. The page still renders with status 200. Report the log line, but it is not a navigation failure.
- Below 1200px the sidebar collapses behind `Open navigation`, and its links sit in a dialog closed by `Close navigation`.
