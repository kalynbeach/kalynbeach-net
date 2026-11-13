# kalynbeach-net agent guide

kalynbeach-net is Kalyn Beach's personal website, [kalynbeach.net](https://www.kalynbeach.net). Kalyn uses he/him. `README.md` is for people reading the repository. It covers the stack and the architecture. This file holds the rules and commands for working in it.

Issues live in GitHub Issues on `kalynbeach/kalynbeach-net`. Use the `gh` CLI for them.

## Copy

Kalyn writes all site copy. Page copy lives in `content/*.mdx`, and each file's `metadata` export holds its page's title and lede. When a change needs copy, move Kalyn's text as it is, or add text marked as a placeholder for him to replace.

## Installed Kevelle files

These paths are installed from the `@kkb` shadcn registry in `components.json`. Their source is the `kalynbeach/kkb` repository:

- `components/ui/`, `components/wave-player/`, and `components/waveform/`
- `lib/audio/`, `lib/phosphor/`, `lib/scope/`, and `lib/accessible-name.ts`
- `app/kevelle/kevelle.css` and `app/kevelle/typeset.css`
- `scripts/kevelle-fonts.ts`

To change one of these files, change it in kkb. After the kkb change merges, reinstall it here:

1. Run `bunx shadcn add @kkb/kevelle/<name> --overwrite` for each changed registry item.
2. Run `bun run format`.
3. Set `cn` back to `^0.5.0` in `package.json` and restore `bun.lock`. The registry writes an older `cn`.

Comments in these files cite kkb paths such as `tools/aura.ts`. Those paths exist in kkb, so leave the comments as they are. The site's own tokens and styles go in `app/globals.css`.

## Convex

`bunx convex dev`, `bunx convex deploy`, and `bunx convex run` change a live Convex deployment. Run them only when Kalyn asks. To typecheck Convex code without a push, run `bun run typecheck --project convex/tsconfig.json`.

`migrations:seedPreview` adds sample tracks and looks. Run it only on preview and dev deployments, never on production.

## Deploys

Vercel builds every push. `vercel.json` sets its install command to `bun install --frozen-lockfile` and its build command to `bunx convex deploy --cmd 'bun run build' --preview-run 'migrations:seedPreview'`. Both override the Vercel project settings. On a branch, it creates or reuses that branch's Convex preview deployment, builds the site, and pushes the functions. A new preview deployment then gets the `seedPreview` sample data. On `main`, it builds the site and pushes the production Convex functions, so a merge to `main` deploys production.

## Publishing

Production serves only published pages and drops every `<Draft>` block. Vercel previews and `bun run dev` show everything.

- To publish a page or a software project, set its `published` flag in `lib/site.ts` to `true`.
- To publish a section of a page, remove its `<Draft>` wrapper in the content file.

`next.config.ts` sets `SITE_PUBLISHED_ONLY` to `true` when `VERCEL_ENV` is `production`. To check production locally, run `VERCEL_ENV=production bun run build`.

## Fonts

`scripts/kevelle-fonts.ts` downloads the licensed ABC Areal, TX-02, and Timeless Serif files into `public/fonts/` before `dev` and `build`. Their licenses forbid committing them to a public repository, and `.gitignore` keeps them out of git. Keep the files, their license numbers, and any token out of commits, PRs, and issues.

## Checks

Run these before you commit. Every one must pass. The `CI` workflow, `.github/workflows/ci.yml`, runs the same checks on every PR and every push to `main`.

```sh
bun run lint
bun run format:check   # `bun run format` fixes it
bun run typecheck
bun run typecheck --project convex/tsconfig.json
bun run test run       # add a path, such as tests/site.test.ts, to run one file
```

Run `bun run build` too when a change touches routes, config, or the build. It downloads the fonts first, as the Fonts section describes. `bun run dev` also needs the Convex and Clerk settings in Kalyn's `.env.local`. Never copy that file into another checkout.

- To add, rename, or remove a public page or a software project, change `lib/site.ts`, `content/`, and `tests/site.test.ts` together. The test fails when the site map, the route files, and the content files disagree. Each page and project also has a `published` flag in `lib/site.ts`.
- To add a software project page, add `content/software/<slug>.mdx`, add its slug and navigation label to `software` in `lib/site.ts`, add `<Project slug="<slug>" />` to `content/software.mdx` and the file's `?metadata` import to `projects` in `components/site/project.tsx`, and add the project to the navigation and Cmd+K expectations in `tests/site.test.ts`.
- After you upgrade `oxlint`, `@oxlint/plugins`, `@convex-dev/eslint-plugin`, or a rule in `tools/oxlint/`, run `bun run test run tests/tools`.

## Tooling notes

- Oxlint is the only linter and Oxfmt is the only formatter. The rules live in `.oxlintrc.json`.
- The Convex lint rules run without type information. They recognize literal `query` and `mutation` registrars, `ctx.db` calls, and inline query chains. Code that passes them can still break a rule, so read Convex code against the rules in `.oxlintrc.json`.
- Oxlint's `correctness` rules and the `anti-slop` rules report errors, so a `debugger` statement or a chained type assertion fails `bun run lint`. Five `jsx-a11y` rules stay warnings. Three of them fire on installed Kevelle files in `components/ui/`. The other hits are deliberate site code, such as the `autoFocus` on the looks editor's Delete confirm and the MDX link that gets its text from props.
- The `@shadcn/lint` rules report warnings, so `bun run lint` passes with them. `components/ui/**` is exempt from `no-restyle`, `no-arbitrary-values`, and `require-static-classes`.
- Keep `oxlint` and `@oxlint/plugins` pinned to the same version. Oxlint's JavaScript plugin API is alpha, so read the lint output after every upgrade.
- TypeScript is pinned to 7.0.2. The lint plugins' `@typescript-eslint` packages declare TypeScript peer ranges below 7. Lint and tests pass today, so recheck both when you upgrade these tools.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
