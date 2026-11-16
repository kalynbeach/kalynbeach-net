---
name: verify-kalynbeach-net
description: Launch kalynbeach.net locally against a seeded local Convex backend, drive its web pages in a headless browser, and capture proof. Use to verify a site change in the running app, reproduce a UI bug, or check what production's published-only mode serves.
---

# Verify kalynbeach.net

The site is a Next.js app. Visitors touch web pages, so every proof drives a browser. The helper `scripts/verify` (path relative to this file) owns the instance's lifecycle. Run it from anywhere in the checkout. Examples below call it `verify`:

```sh
verify() { "$(git rev-parse --show-toplevel)/.agents/skills/verify-kalynbeach-net/scripts/verify" "$@"; }
```

## Launch

```sh
verify launch                   # every page and <Draft> section, like a Vercel preview
verify launch --published-only  # what production serves, with VERCEL_ENV=production
```

Launch is ready when it prints a green doctor table and the `VERIFY_*` variables. It takes about 10 seconds plus first compiles. It does this, in order:

1. Refuses if this checkout already has an instance, or if `.env.local`, `.env`, `.convex/local/default`, or `~/.convex/anonymous-convex-backend-state/anonymous-agent` exists. The main checkout holds Kalyn's real `.env.local`, so verify from a worktree. It also clears inherited `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, and the other Convex target variables.
2. Starts `bunx convex dev` on a fresh anonymous local backend (`CONVEX_AGENT_MODE=anonymous`). Its data lives in `.convex/local/default`, and Convex writes its URL to `.env.local`. Nothing reaches a cloud deployment.
3. Sets `CLERK_JWT_ISSUER_DOMAIN` on that backend, then seeds it with `migrations:seedPreview`: two tracks, `preview_tone_a` and `preview_tone_b`, 8 seconds each, with their looks.
4. Starts `bun run dev` with Kalyn's Clerk test keys in its process environment. It takes `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the shell if set, or else reads those two lines from the main checkout's `.env.local` (override the file with `VERIFY_CLERK_ENV_FILE`). They go only into `next dev`'s environment, along with this run's `NEXT_PUBLIC_CONVEX_URL`, and are written nowhere.
5. Compiles the mapped routes, then runs `verify doctor`. Any failure or interrupt before that passes tears the partial instance down.

Ports start at 3100 (web) and 3210 (Convex) and move up past busy ones, so instances in different checkouts run side by side. One checkout holds one instance.

`bun run dev` runs `scripts/kevelle-fonts.ts` first. It needs `gh auth token` or `KEVELLE_FONTS_TOKEN` only when `public/fonts/` lacks the licensed files. If the fetch fails, report it. Keep font files and tokens out of evidence.

`verify env` prints the run's variables again: `VERIFY_URL`, `VERIFY_EVIDENCE`, `VERIFY_LOGS`, `VERIFY_MODE`, `VERIFY_SESSION`. Load them with `eval "$(verify env)"` in every new shell, along with the `verify` function.

## Doctor

```sh
verify doctor
```

Read-only. Run it first whenever anything looks off. It checks that both process groups live and are this run's (by leader start time), that this run owns both ports, that `.env.local` and `next dev`'s environment both name this run's backend, that `tracks:list` returns the seeded tracks, that `/` is 200, that a signed-out `/dashboard` is a 307 to `/login`, that `/software` matches the mode (200, or 404 when published-only), and that the Clerk key is a `pk_test_` key. It exits 1 on any `FAIL`. Logs are in `$VERIFY_LOGS` (`convex.log`, `next.log`, `seed.json`).

## Drive

```sh
verify browser open "$VERIFY_URL/sound"
verify browser find role button click --name "Play"
verify browser snapshot -s main
```

`verify browser` runs `agent-browser` in the run's own session with the shipped `scripts/browser.json` (headless, audio muted) and `--no-auto-connect`. It ignores `~/.agent-browser/config.json` and every `AGENT_BROWSER_*` variable, so it cannot attach to a browser Kalyn is using. The default viewport is 1280 wide, the desktop layout. The layout switches below 1200px (`verify browser set viewport 1100 800`). Run `agent-browser skills get core` for the full command set.

- Address elements by role and accessible name (`find role button click --name "Next track"`). Snapshot refs such as `@e12` change on every render, so use them only right after the snapshot that printed them.
- Wait on state, not time: `wait --text "Not found"`, `wait --url "**/login"`, `wait --fn "<js>"`.
- Next's dev tools add a `button "Open Next.js Dev Tools"` and an empty `alert` to every page. Ignore both.

[`features/README.md`](features/README.md) indexes the feature map. Read the feature's file before you drive it, and drive every entry point it lists.

## Evidence

Save proof under `$VERIFY_EVIDENCE/<feature>/`. It survives `verify stop`.

```sh
mkdir -p "$VERIFY_EVIDENCE/sound-player"
verify browser snapshot -s main > "$VERIFY_EVIDENCE/sound-player/after-play.aria.txt"
verify browser screenshot "$VERIFY_EVIDENCE/sound-player/after-play.png"
```

Proof standards:

- Drive the path a visitor takes: clicks, keys, and URLs. Leave Convex functions, React state, and `eval` setters out of the action. `eval` may read state for an assertion.
- Capture the action and the state it caused. A snapshot before and after beats a final screenshot.
- Check side effects through a second view. A track that plays on Sound should still show in the mini player after navigating to About.
- Name the mode (`$VERIFY_MODE`) and the commit (`verify doctor` prints it) next to every claim.
- Report a journey you could not reach, with the command you ran and the unmet precondition. Never count another entry point as proof of it.

## Cleanup

```sh
verify stop
```

It closes the browser session and kills the two process groups this run started, after checking each leader's start time. Once the groups exit and the ports close, it deletes `.convex/local/default` and the `.env.local` it created. If anything is still running, it keeps all state, names what is left, and exits 1. It keeps `.verify/runs/<run>/` with `logs/` and `evidence/`, and prints the evidence count. Run it after every attempt, failed ones included. `.verify/` is in `.gitignore`. Move old runs to the Trash when they are no longer needed.
