# kalynbeach-net

This is the source for [kalynbeach.net](https://www.kalynbeach.net), my personal website.

This site uses my `Kevelle` design system, which I'm building in my kkb monorepo and distributing via a personal registry.

## Tech stack

- [Next.js](https://nextjs.org) 16.4 with the App Router, React 19.3, and the React Compiler
- TypeScript 7, the native compiler
- Tailwind CSS 4
- Kevelle components, blocks, and styles, installed from the kkb [shadcn](https://ui.shadcn.com) registry at `registry.kkb.systems`. They're built on [Base UI](https://base-ui.com) and use [Phosphor](https://phosphoricons.com) icons.
- MDX for page content, through `@next/mdx`
- [Convex](https://www.convex.dev) for data and audio file storage
- [Clerk](https://clerk.com) for sign-in
- [Vercel](https://vercel.com) for hosting, Analytics, and Speed Insights
- [Bun](https://bun.com) for packages and scripts, Vitest for tests, and Oxlint and Oxfmt for linting and formatting

## Architecture

`lib/site.ts` is the site map. It lists the public pages for the navigation, the admin pages for the Cmd+K menu, and the sign-in pages, and it says how each public page shows the music player. The root layout wraps every page in the shell, `components/site/shell.tsx`. The shell draws the sidebar, the Home waveform, and the player, and `lib/layout.ts` places them for desktop or for narrow screens below 1200px.

Each public page's copy lives in an MDX file in `content/`. The file's `metadata` export sets the page title and lede, and `mdx-components.tsx` sets every page in Kevelle's typeset styles.

Tracks are audio files in Convex storage. A look is a saved setting for the waveform. On each request, the root layout reads the track list and the live look from Convex and waits at most 1 second. In the browser, the shell then subscribes to both, so an open page picks up every upload and look change from the dashboard.

Clerk signs people in, and Convex gives them roles. Everyone starts as a guest, and the site makes one configured account, mine, the admin. `app/(admin)/layout.tsx` and every admin Convex function check for the admin role.

## Archive

The pages that came before the redesign live on in git tags. The old sound pages are at `archive/sound-2026-10`, and the first WavePlayer is at `archive/legacy-wave-player-2026-10-04`.
