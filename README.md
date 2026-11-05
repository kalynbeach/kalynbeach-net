# kalynbeach-net

This is the source for [kalynbeach.net](https://www.kalynbeach.net), my personal website. It's where I write about the software I build and play the music I make. The site is also the first real home of Kevelle, the design system I build in my kkb monorepo.

## Site structure

| Page                    | What's there                                                                   | Source                                           |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| Home, `/`               | A live waveform that fills the page. Press `?` to see the keys that change it. | `components/site/shell.tsx`                      |
| About, `/about`         | Who I am, and where to find me                                                 | `content/about.mdx`                              |
| Software, `/software`   | The projects I build, with a full page for some of them                        | `content/software.mdx`, `content/software/*.mdx` |
| Music, `/music`         | My tracks, played through WavePlayer                                           | `content/music.mdx`, with tracks from Convex     |
| Dashboard, `/dashboard` | Admin only. Upload tracks and edit waveform looks.                             | `components/dashboard/`, `components/looks/`     |
| Lab, `/lab`             | Admin only. A three.js tool that exports a mesh as SVG.                        | `components/r3f/`                                |

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

## Codebase layout

| Path                                                                                                                             | What it holds                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `content/`                                                                                                                       | Page copy, one MDX file per page                                                                            |
| `app/`                                                                                                                           | Routes. About, Software, and Music re-export their MDX files, and each project page loads its file by slug. |
| `components/site/`                                                                                                               | The site shell: sidebar, navigation, Cmd+K menu, waveform controls, and the components that MDX pages use   |
| `components/dashboard/`, `components/looks/`                                                                                     | The admin dashboard's track uploads and waveform look editor                                                |
| `convex/`                                                                                                                        | The Convex schema and functions for users, tracks, looks, and playlists                                     |
| `lib/site.ts`, `lib/layout.ts`                                                                                                   | The site map, and where the waveform and the player go at each screen width                                 |
| `lib/convex/`                                                                                                                    | Server-side Convex reads and the admin check                                                                |
| `components/ui/`, `components/wave-player/`, `components/waveform/`, `lib/audio/`, `lib/phosphor/`, `lib/scope/`, `app/kevelle/` | Kevelle, installed from the registry. Changes to these files start in kkb.                                  |
| `scripts/kevelle-fonts.ts`                                                                                                       | Downloads the licensed fonts before `dev` and `build`                                                       |
| `tests/`                                                                                                                         | Vitest tests, including the site map, the layout, the Convex logic, the dashboard, and the lint setup       |

## Architecture

`lib/site.ts` is the site map. It lists the public pages for the navigation, the admin pages for the Cmd+K menu, and the sign-in pages, and it says how each public page shows the music player. The root layout wraps every page in the shell, `components/site/shell.tsx`. The shell draws the sidebar, the Home waveform, and the player, and `lib/layout.ts` places them for desktop or for narrow screens below 1200px.

Each public page's copy lives in an MDX file in `content/`. The file's `metadata` export sets the page title and lede, and `mdx-components.tsx` sets every page in Kevelle's typeset styles.

Tracks are audio files in Convex storage. A look is a saved setting for the waveform. On each request, the root layout reads the track list and the live look from Convex and waits at most 1 second. In the browser, the shell then subscribes to both, so an open page picks up every upload and look change from the dashboard.

Clerk signs people in, and Convex gives them roles. Everyone starts as a guest, and the site makes one configured account, mine, the admin. `app/(admin)/layout.tsx` and every admin Convex function check for the admin role.

## Archive

The pages that came before the redesign live on in git tags. The old sound pages are at `archive/sound-2026-10`, and the first WavePlayer is at `archive/legacy-wave-player-2026-10-04`.
