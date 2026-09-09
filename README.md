# kalynbeach-net

> 🌐 [kalynbeach.net](https://www.kalynbeach.net)

## Commands

- **Build:** `bun run build`
- **Lint:** `bun run lint`
- **Test:** `bun run test` (watch) | `bun run test run` (once)
- **Test Single:** `bun run test run [filename]`
- **Format:** `bun run format`
- **Check formatting:** `bun run format:check`
- **Check types:** `bun run typecheck`
- **Convex Dev:** `bunx convex dev`
- **Convex Check:** `bunx convex dev --once --typecheck enable --tail-logs disable`

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19.2, Tailwind CSS v4.
- **Runtime:** Bun (Strictly use `bun`/`bunx`).
- **Identity:** Clerk.
- **Data/Roles:** Convex (`guest | vip | admin`), Zod (Validation).
- **UI:** `shadcn/ui` (Radix), `lucide-react`, `react-three-fiber` (R3F).

## Key Architectures

- **Audio (3 Systems):**
  - **Refactored (Target):** `lib/sound.ts`, `components/sound/`.
  - **Wave-Player (Active):** `components/wave-player/` (Playlist/Tracks).
  - **Wave-Lab (Legacy):** `components/wave-lab/` (Do not modify unless requested).
- **3D:** Located in `components/r3f/`.
- **Auth:** Clerk establishes identity; sensitive Convex functions enforce app roles.
- **Data:** Convex schema/functions live in `convex/`; server adapters live in `lib/convex/`.

## Linting and formatting

Oxlint runs the rules in [`.oxlintrc.json`](.oxlintrc.json). Oxfmt uses
[`.oxfmtrc.json`](.oxfmtrc.json), with an 80-column width, semicolons, double quotes,
ES5 trailing commas, and Tailwind class sorting. Import and package field sorting
are disabled. Generated Convex files and vendored rule source are excluded from
linting and formatting. TypeScript still checks the vendored rules.

VS Code and Cursor users can install the recommended `oxc.oxc-vscode` extension.
The workspace selects it as the formatter without changing format-on-save preferences.

### Rule coverage

The configuration explicitly lists the migrated Next.js, React, accessibility,
and TypeScript rules rather than enabling new categories by default. It preserves
the Wave Lab exceptions for `react/immutability` and `react/refs`.

The following differences from the previous ESLint configuration are intentional:

| Previous rule                                        | Current behavior                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `react/jsx-uses-react`, `react/jsx-uses-vars`        | The automatic JSX transform and Oxlint's unused-variable analysis handle these cases.                                              |
| `react-hooks/config`, `react-hooks/gating`           | Oxc uses fixed compiler options; these configuration checks have no native equivalent. The app does not configure compiler gating. |
| `react/no-deprecated`                                | Retired. Oxlint's general deprecation rule requires a separate type-aware engine, which this setup does not enable.                |
| `@next/next/no-location-assign-relative-destination` | Retired pending native support. Internal navigation continues to use Next's navigation APIs.                                       |
| `react/require-render-return`                        | Enabled explicitly despite its current nursery status; Oxlint is pinned.                                                           |
| Convex recommended rules                             | Replaced by the local syntax checks described below.                                                                               |

See the [Oxlint migration guide](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint)
and [React Compiler rule coverage](https://oxc.rs/blog/2026-08-18-react-compiler-support).
There is no ESLint runtime or fallback. Convex's CLI still depends on Prettier
transitively, and Oxfmt bundles it for some languages; project formatting runs only Oxfmt.

### Local Convex checks

[`tools/oxlint/convex.ts`](tools/oxlint/convex.ts) requires object syntax and an
explicit `args` property for directly imported Convex registrar calls, including
renamed imports. It requires table arguments for `db` and `ctx.db`
`get`, `delete`, `patch`, and `replace` calls, and warns on inline database query
filters. Array filtering after query execution remains allowed.

These checks use syntax, not TypeScript receiver types. They do not follow
arbitrary database aliases, stored query variables, registrar wrappers, or imported
configuration objects. The previous untyped setup also lacked query-variable
analysis and silently skipped its explicit-table rule. `bun run typecheck` checks
the table-first calls against Convex's generated types. No table names are autofixed.

### Selected anti-slop rules

[`tools/oxlint/anti-slop.ts`](tools/oxlint/anti-slop.ts) enables two rules as warnings:
`no-chained-type-assertions` and `no-widen-then-assert`. Existing test doubles that
use chained assertions remain visible as warnings. Runtime validation of `unknown`
inputs is allowed; the other upstream anti-slop policies are not enabled.

Source and license provenance are recorded in the
[vendor README](tools/oxlint/vendor/anti-slop/README.md). Keep `oxlint` and
`@oxlint/plugins` pinned to matching versions and run `bun run test run tests/tools`
when updating either the plugin API or vendored rules. JavaScript plugin support
is still alpha, so dependency upgrades need a diagnostic review.
