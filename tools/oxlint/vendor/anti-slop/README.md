# Vendored anti-slop rules

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop),
commit [`95a56e5d24fb3d849673c2d51eb0908b8bd2d33b`](https://github.com/dmmulroy/anti-slop/tree/95a56e5d24fb3d849673c2d51eb0908b8bd2d33b),
September 8, 2026. Copyright 2026 Dillon Mulroy, MIT license in [LICENSE](LICENSE).

Only these source files are copied, without modifications:

- `src/rules/no-chained-type-assertions.ts`
- `src/rules/no-widen-then-assert.ts`

The local entry point selects these rules and configures them as warnings. It uses
Oxlint's `definePlugin` instead of the upstream entry point's ESLint compatibility
wrapper. No ESLint package is required.

To update, compare the selected source files against a specific upstream commit,
copy the files and license, update this reference, and run
`bun run test run tests/tools`, `bun run typecheck`, and `bun run lint`.
Keep `oxlint` and `@oxlint/plugins` versions identical. This directory is excluded
from formatting and lint fixes so upstream comparisons remain exact.
