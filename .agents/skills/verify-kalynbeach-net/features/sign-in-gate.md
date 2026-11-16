# Sign-in gate

Admin pages are for Kalyn. A signed-out visitor who opens one lands on the sign-in page, which offers GitHub and email sign-in through Clerk.

## Sub-features

- `gate-redirect` sends a signed-out visitor from `/dashboard` and `/lab`, and any path under them, to `/login` with a 307.
- `gate-login` shows the `Sign in` page with the Clerk form.
- `gate-admin` lets the admin account use the dashboard and the lab. Not drivable by an agent. See Gotchas.

## How to get to it (user POV)

- Open `/dashboard` or `/lab`.
- Choose `Dashboard` or `Lab` in the Cmd+K palette.
- Open `/login`.

## Driving it with verify browser

Preconditions:

- Baseline state from the [index](./README.md), signed out.

- **Redirect over HTTP.** Run `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$VERIFY_URL/dashboard"`, and the same for `/lab` and `/dashboard/anything`. Each prints `307 $VERIFY_URL/login`.
- **Redirect in the browser.** Run `verify browser open "$VERIFY_URL/dashboard"` and `verify browser wait --url "**/login"`. The heading is `Sign in`.
- **From the palette.** Run `verify browser open "$VERIFY_URL/"`, `verify browser press Meta+k`, `verify browser keyboard type "Lab"`, and `verify browser press Enter`. `verify browser wait --url "**/login"` passes.
- **Sign-in form.** Run `verify browser wait --text "Continue with GitHub"` and `verify browser snapshot -s main`. `main` holds the heading `Sign in`, the button `Continue with GitHub`, the textbox `Email address`, and the button `Continue`.
- **Proof.** Save the `curl` lines, the `/login` snapshot, and a screenshot under `$VERIFY_EVIDENCE/sign-in-gate/`.

## Gotchas

- `gate-admin` needs Kalyn's Clerk account, which an agent cannot sign in to. Report it as not verified, with the reason. Do not submit the sign-in form.
- The Clerk form loads from Clerk's servers, so `Continue with GitHub` appears a moment after the heading. Wait for its text.
- A signed-in guest gets a 200 on an admin page and an in-page redirect to `/auth/unauthorized`. This map has no guest account, so that path is unverified too.
