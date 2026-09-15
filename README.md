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
- **Check Convex types (local only):** `bun run typecheck --project convex/tsconfig.json`

`convex dev` pushes backend code; it is not a read-only typecheck.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19.2, Tailwind CSS v4.
- **Runtime:** Bun (Strictly use `bun`/`bunx`).
- **Identity:** Clerk.
- **Data/Roles:** Convex (`guest | vip | admin`), Zod (Validation).
- **UI:** `shadcn/ui` (Radix), `lucide-react`, `react-three-fiber` (R3F).

## TypeScript

TypeScript is pinned to **7.0.2**, the native compiler. `bun run typecheck`,
Convex's CLI, and Next.js builds use the project compiler. Next.js 16.3.5 uses
CLI typechecking by default; no `experimental.useTypeScriptCli` override or
TypeScript 6 compatibility package is needed.

TypeScript 7 no longer automatically includes every installed `@types` package.
The Convex tsconfig explicitly includes Node types for `process.env`; the root
project receives Node types through Next's declarations. Run both typecheck
commands above because the root check does not use Convex's separate config.

### Editors

The project compiler and editor language server are separate choices. In Zed,
the [TypeScript Language Server extension](https://github.com/zed-extensions/tsgo)
provides `typescript-ls` for TypeScript and TSX and supports pinning its package
version to `7.0.2`. Neovim likewise needs a native-TS-compatible language-server
configuration to use TS 7 in the editor. Personal editor changes are optional
and are not managed by this repository.

The native language server does not load Next's legacy IDE plugin. This affects
plugin-specific suggestions and diagnostics, not ordinary TS/React tooling or
Next-generated types. Whether switching loses anything depends on the previous
editor setup. See [Next's TypeScript documentation](https://nextjs.org/docs/app/api-reference/config/typescript).
VS Code's legacy `typescript.tsdk` workspace override is removed because TS 7
does not ship the old `tsserver` SDK; use a TS 7-compatible editor integration.

### Tooling compatibility

The Convex and shadcn lint plugins' transitive `@typescript-eslint` packages still
declare TypeScript `<6.1.0` support, and `tsconfck` declares an optional TypeScript 5
peer.
Those ranges do not officially cover TS 7. The configured Oxlint integration
uses non-type-aware Convex rules, and `vite-tsconfig-paths` does not enable
`parseNative`. Lint and the existing integration tests pass without a legacy
compiler. Do not infer that the underlying TypeScript compiler-API integrations
are compatible; recheck this boundary when changing these tools or their modes.

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
| Convex recommended rules                             | Official plugin 4.0.0 runs through Oxlint's JS-plugin API, using its non-type-aware checks.                                        |

See the [Oxlint migration guide](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint)
and [React Compiler rule coverage](https://oxc.rs/blog/2026-08-18-react-compiler-support).
Linting runs only Oxlint, with no ESLint CLI step or fallback. The official Convex
plugin brings ESLint in transitively through `@typescript-eslint/utils`; it is
installed, but not used as the lint runner. Convex's CLI still depends on Prettier
transitively, and Oxfmt bundles it for some languages; project formatting runs only Oxfmt.

### Official Convex checks

[`@convex-dev/eslint-plugin`](https://docs.convex.dev/eslint) is pinned to 4.0.0
and loaded directly through Oxlint's JS-plugin API. The Convex override explicitly
mirrors its recommended rules and severities: object-style function registration,
argument validators, explicit table IDs, inline query-filter warnings, top-of-hour
cron warnings, and schema import-cycle detection. Runtime-import restrictions and
`no-collect-in-query` remain opt-in and are not enabled.

Version 3 added non-type-aware table-ID detection, replacing the need for our local
Convex rules. Under Oxlint, the official plugin uses syntax rather than TypeScript
receiver types. Registrar checks recognize literal names such as `query` and
`mutation`, not renamed imports. Table-ID checks recognize
`ctx.db.get/patch/replace/delete`, not bare `db`, arbitrary aliases, or
string-computed methods. Query filtering is checked
on inline query chains, not stored query variables; array filtering after collection
remains allowed. Schema-cycle detection follows relative imports, not path aliases.
No table names are autofixed without type information. `bun run typecheck` still
checks table-first calls against Convex's generated types.

Oxlint's native type-aware mode does not expose type information to JavaScript
plugins. The integration test in `tests/tools/lint-config.test.ts` verifies all six
configured Convex rules against the actual Oxlint CLI, including filesystem-based
schema-cycle detection. Run `bun run test run tests/tools` when upgrading the plugin.

### shadcn design-system lint setup

`@shadcn/lint` is registered through Oxlint's `jsPlugins`. Run `bun run lint`
as usual. Five rules are enabled as warnings: `no-restyle`, `no-arbitrary-values`,
`no-raw-colors`, `no-inline-styles`, and `require-static-classes`. The first two
allow layout classes. Existing non-shadcn lint policies are unchanged.

Following the [adoption guide](https://github.com/shadcn-ui/lint/blob/main/docs/adoption.md),
these warnings surface cleanup work without failing lint. Promote them to errors
as the codebase is cleaned up. Project-specific design-system contracts remain a
follow-up.

Configure `shadcn/*` rules under `rules` in [`.oxlintrc.json`](.oxlintrc.json).
See the [available rules](https://github.com/shadcn-ui/lint/blob/main/README.md#rules)
and [design-system configuration examples](https://github.com/shadcn-ui/lint/blob/main/docs/design-systems.md).
Component imports (`@/components/ui`) and the Tailwind v4 theme (`app/globals.css`)
are discovered through `components.json` and the TypeScript path alias; no custom
discovery settings are needed.

### Focused native checks

The built-in `vitest` plugin is scoped to `*.test.*` and `*.spec.*` JS/TS files.
It rejects focused tests, malformed expectations, and unawaited/unreturned async
expectations. `valid-expect` permits Vitest's optional second message argument.

Four additional `jsx-a11y` warnings cover click handlers without keyboard handlers,
interactive roles without focus support, static elements with interaction handlers,
and positive tab indices. Prefer native buttons and links over adding roles to divs.
Existing Wave Lab React exceptions do not disable these checks.

See [Oxlint's built-in plugins](https://oxc.rs/docs/guide/usage/linter/plugins).
Type-aware async rules (`no-floating-promises`, `no-misused-promises`) remain a
separate follow-up; this migration does not enable a broad style preset or
allocation-focused React performance rules.

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
