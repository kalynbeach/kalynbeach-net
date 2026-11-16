# kalynbeach.net verification map

This directory is the maintained source for verifying what visitors can do on kalynbeach.net. Read this index before driving the site, then use the matching feature file as the recipe.

## Baseline preconditions

- `verify launch` succeeded in this checkout, and `verify doctor` is green.
- The local backend holds only the seed: `preview_tone_a` (01) and `preview_tone_b` (02), 8 seconds each, Kalyn Beach, record `preview`.
- The browser is signed out. No journey here signs in.
- `eval "$(verify env)"` has loaded `VERIFY_URL` and `VERIFY_EVIDENCE` in the current shell.
- Never drive an instance this run did not start.

## Driving conventions

- Start each recipe with `verify browser open` on its first URL, so earlier state does not carry over.
- Find elements by role and accessible name. Quote names exactly as written here.
- Run browser actions through `verify browser <agent-browser command>`.
- Wait for the state a step names, with `wait --text`, `wait --url`, or `wait --fn`, rather than a fixed sleep.
- The drives here change nothing stored. A journey that must write, such as a dashboard upload, writes only to this run's local backend, and `verify stop` discards it.

## Proof and skip reporting

- Capture the action and the state it caused, not only the final screen.
- UI proof is an ARIA snapshot (`snapshot -s main` or a narrower scope) plus a screenshot, saved under `$VERIFY_EVIDENCE/<feature>/`.
- HTTP proof is the `curl -s -o /dev/null -w '%{http_code} %{redirect_url}'` line for the URL.
- Record the feature file, the sub-feature IDs, the entry point, and `$VERIFY_MODE` with every artifact.
- Report an unreachable path with the command you ran and the unmet precondition.
- Never report a skipped entry point as verified through a different one.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing what the visitor sees. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every visitor entry point.
3. `Driving it with verify browser` starts with `Preconditions:` and pairs each visitor action with an exact command and the result to observe.
4. `Gotchas` lists traps that waste or invalidate a run.

Keep implementation details out of the map. Name only visitor paths, accessible names, required state, commands, and observable proof.

## Features

- [Sound player](./sound-player.md) covers play and pause, track skipping, the Library, seeking, and the mini player that follows the visitor.
- [Navigation](./navigation.md) covers the sidebar, the Cmd+K palette, legacy redirects, and the not-found page.
- [Home waveform](./home-waveform.md) covers striking the waveform and the `?` key map with its live readouts.
- [Sign-in gate](./sign-in-gate.md) covers signed-out admin redirects and the Clerk sign-in page.
- [Published-only mode](./published-only.md) covers what production hides: unpublished pages, their nav rows and Cmd+K items, and `<Draft>` sections.
