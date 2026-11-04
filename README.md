# kalynbeach-net

This is the source for [kalynbeach.net](https://www.kalynbeach.net), my personal website. It's where I write about the software I build and play the music I make. The site is also the first real home of Kevelle, the design system I build in my kkb monorepo.

## What's on the site

| Page                    | What's there                                                                   | Source                                           |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| Home, `/`               | A live waveform that fills the page. Press `?` to see the keys that change it. | `components/site/shell.tsx`                      |
| About, `/about`         | Who I am, and where to find me                                                 | `content/about.mdx`                              |
| Software, `/software`   | The projects I build, with a full page for some of them                        | `content/software.mdx`, `content/software/*.mdx` |
| Music, `/music`         | My tracks, played through WavePlayer                                           | `content/music.mdx`, with tracks from Convex     |
| Dashboard, `/dashboard` | Admin only. Upload tracks and edit waveform looks.                             | `components/dashboard/`, `components/looks/`     |
| Lab, `/lab`             | Admin only. A three.js tool that exports a mesh as SVG.                        | `components/r3f/`                                |

## How it's built

- [Next.js](https://nextjs.org) 16.4 with the App Router, React 19.3, and the React Compiler
- TypeScript 7, the native compiler
- Tailwind CSS 4
- Kevelle components, blocks, and styles, installed from the kkb [shadcn](https://ui.shadcn.com) registry at `registry.kkb.systems`. They're built on [Base UI](https://base-ui.com) and use [Phosphor](https://phosphoricons.com) icons.
- MDX for page content, through `@next/mdx`
- [Convex](https://www.convex.dev) for data and audio file storage
- [Clerk](https://clerk.com) for sign-in
- [Vercel](https://vercel.com) for hosting, Analytics, and Speed Insights
- [Bun](https://bun.com) for packages and scripts, Vitest for tests, and Oxlint and Oxfmt for linting and formatting

## Find your way around

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

## How the pieces fit together

`lib/site.ts` is the site map. It lists the public pages for the navigation, the admin pages for the Cmd+K menu, and the sign-in pages, and it says how each public page shows the music player. The root layout wraps every page in the shell, `components/site/shell.tsx`. The shell draws the sidebar, the Home waveform, and the player, and `lib/layout.ts` places them for desktop or for narrow screens below 1200px.

Each public page's copy lives in an MDX file in `content/`. The file's `metadata` export sets the page title and lede, and `mdx-components.tsx` sets every page in Kevelle's typeset styles.

Tracks are audio files in Convex storage. A look is a saved setting for the waveform. On each request, the root layout reads the track list and the live look from Convex and waits at most 1 second. In the browser, the shell then subscribes to both, so an open page picks up every upload and look change from the dashboard.

Clerk signs people in, and Convex gives them roles. Everyone starts as a guest. The Clerk user named in `INITIAL_ADMIN_CLERK_USER_ID` becomes the admin the first time they open an admin page. `app/(admin)/layout.tsx` and every admin Convex function check for that role.

## Run it locally

You need:

- [Bun](https://bun.com)
- Read access to the private `kalynbeach/kkb` repository, through `gh auth login` or a GitHub token in `KEVELLE_FONTS_TOKEN`. Before they start, `bun run dev` and `bun run build` download any licensed font that is missing or out of date, and they stop if the download fails.
- A Convex account and a Clerk application

To start the site:

1. Install the dependencies with `bun install`.
2. Run `bunx convex dev` and keep it running. The first run creates a dev deployment and writes its URL to `.env.local`. After that, it pushes `convex/` to the dev deployment on every save.
3. In the Clerk dashboard, turn on the Convex integration and copy your Frontend API URL.
4. Set the Convex variables with `bunx convex env set CLERK_JWT_ISSUER_DOMAIN <frontend-api-url>`. To use the dashboard, also set `INITIAL_ADMIN_CLERK_USER_ID` to your Clerk user ID.
5. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from Clerk to `.env.local`.
6. To add sample tracks and looks, run `bunx convex run migrations:seedPreview`. This step is optional.
7. Run `bun run dev`, then open http://localhost:3000.

| Variable                                                | Where it's set                        | What it's for                            |
| ------------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`                                | `.env.local`, written by `convex dev` | The Convex deployment the site reads     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | `.env.local`                          | Clerk sign-in                            |
| `CLERK_JWT_ISSUER_DOMAIN`                               | The Convex deployment                 | Lets Convex verify Clerk tokens          |
| `INITIAL_ADMIN_CLERK_USER_ID`                           | The Convex deployment                 | The Clerk user who becomes the admin     |
| `KEVELLE_FONTS_TOKEN`                                   | Your shell or Vercel                  | Font downloads when `gh` isn't signed in |

## Check a change

| Command                                            | What it does                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `bun run lint`                                     | Lints with Oxlint                                                                                                |
| `bun run format:check`                             | Checks formatting with Oxfmt. `bun run format` fixes it.                                                         |
| `bun run typecheck`                                | Typechecks the app                                                                                               |
| `bun run typecheck --project convex/tsconfig.json` | Typechecks the Convex functions with their own settings, without pushing anything                                |
| `bun run test run`                                 | Runs every test once. Add a path, such as `tests/site.test.ts`, to run one file. `bun run test` watches instead. |
| `bun run build`                                    | Builds the site for production                                                                                   |

VS Code and Cursor recommend the Oxc extension, and the workspace uses it as the formatter. TypeScript 7 needs an editor language server that supports the native compiler.

## Edit content

To change a page, edit its file in `content/`. A page's title and lede are in the file's `metadata` export, and everything below that is the page's MDX.

To add a software project page:

1. Add `content/software/<slug>.mdx`.
2. Add the slug and its navigation label to `software` in `lib/site.ts`.
3. Add `<Project slug="<slug>" />` to `content/software.mdx` where the project belongs.
4. Add the project to the navigation and Cmd+K expectations in `tests/site.test.ts`.

`tests/site.test.ts` fails when the site map, the route files, and the content files disagree.

## Deploy

Vercel builds every push. Its build command, set in the Vercel project, is `bunx convex deploy --cmd 'bun run build' --preview-run 'migrations:seedPreview'`. Each Vercel environment has its own `CONVEX_DEPLOY_KEY`, and that key picks the Convex deployment. On a branch, the command creates or reuses the branch's Convex preview deployment, builds the site, and pushes the functions. A new preview then gets sample tracks and looks from `seedPreview`. On `main`, the command builds the site and pushes the production Convex functions.

The pages that came before the redesign live on in git tags. The old sound pages are at `archive/sound-2026-10`, and the first WavePlayer is at `archive/legacy-wave-player-2026-10-04`.
