# Convex production cutover

This runbook intentionally separates preview deployment, artifact preparation,
production import, and final Supabase removal. Do not infer a production target
from a development deployment or run production commands with a Preview key.

## Completed deployment prerequisites

- Vercel Preview and Production have separately scoped `CONVEX_DEPLOY_KEY`
  values and matching Clerk variables.
- Convex preview defaults and Production deployment `beloved-butterfly-26`
  have their environment-specific Clerk issuer and configured admin values.
- The Vercel Build Command is:

  ```sh
  bunx convex deploy --cmd 'bun run build' --preview-run 'migrations:seedPreview'
  ```

- `migrations:seedPreview` is an internal mutation. It validates and upserts the
  canonical repository seed by stable public IDs without deleting unrelated
  rows. Convex ignores `--preview-run` for Production deployments.
- The reviewed Convex schema and functions are deployed to exact Production
  deployment `beloved-butterfly-26`. Its `users`, `tracks`, `playlists`, and
  `playlistTracks` tables remain empty.

## Production data decision

The paused hosted Supabase project is not the Production migration source. Two
guarded REST export attempts failed before artifact creation because its host is
no longer available. Kalyn downloaded its database backup but explicitly
declined the Docker/local restore audit, so the backup remains unaudited and is
not represented in the candidate data.

Kalyn explicitly chose: "Use the repository seed and discard unaudited legacy
Supabase data."

The only candidate Production dataset is therefore the canonical normalized
repository seed shared with preview seeding: 2 tracks, 1 playlist, and 2
playlist-track relations. Its provenance is pinned to:

- path: `supabase/seed.sql`
- SHA-256:
  `b8b7900047785a132dad452a7a4d6e108bf30623e2d00b62e7a97700f12c1f9c`
- source revision: `7d2544a688a4d3907262adf43dc6bc0bf0eaffea`

The downloaded backup must remain untouched unless Kalyn separately authorizes
a new recovery plan.

## Prepare the candidate artifacts

Artifact preparation is offline: it makes no Supabase, Convex, or other network
request. It refuses a wrong target or confirmation, a changed source-file hash,
or an existing output directory before writing any artifact.

Use a new path that does not exist:

```sh
MIGRATION_TARGET=beloved-butterfly-26 \
MIGRATION_CONFIRM=PREPARE_REPOSITORY_SEED_FOR_CONVEX_PRODUCTION \
bun run migration:prepare:production -- \
  --output /private/tmp/kalynbeach-net-convex-production
```

The preparer writes deterministic `tracks.jsonl`, `playlists.jsonl`,
`playlistTracks.jsonl`, and manifest schema version 2. The manifest records the
exact repository-seed path, hash, revision, legacy-data disposition and decision,
target, 2/1/2 counts, and a SHA-256 digest for each JSONL file.

Artifact generation requires a separate supervisor release. After generation,
audit all manifest fields, file digests, counts, public IDs, timestamps, image
objects, relation positions, and the two existing HTTPS S3 audio URLs. Production
must still be empty before requesting import authorization.

## Import the reviewed artifacts

Production import is not authorized merely because artifacts exist. Obtain a
separate explicit supervisor release after the artifact audit, then run only:

```sh
MIGRATION_TARGET=beloved-butterfly-26 \
MIGRATION_CONFIRM=IMPORT_REPOSITORY_SEED_TO_CONVEX_PRODUCTION \
bun run migration:import:production -- \
  --input /private/tmp/kalynbeach-net-convex-production \
  --mode append
```

The importer accepts only manifest schema version 2 with the exact reviewed
repository-seed provenance and legacy-data decision. Before spawning Convex it
re-hashes the checked-in source and all JSONL files, validates the exact counts
and migration relationships, and rejects the retired `supabase-production`
manifest.

Every Convex read/import uses `--deployment beloved-butterfly-26`. The importer
supports only `--append`; it never infers `--prod` and never uses `--replace`.
Each table must be empty or already match the complete validated file. Any
unmatched or partial state stops the run. After an append, the importer rereads
the table and atomically updates `production-import-state.json` only after an
exact match.

The resume journal is tied to the manifest SHA-256 and its per-file digests. A
journal from another or modified artifact set cannot resume. If Production does
not match a table marked complete, stop for manual review; do not rerun, replace,
or reconcile data without a new approval.

## Final verification and Supabase removal

After an authorized import, verify Production counts, public track and playlist
projections, existing S3 URLs, authenticated admin routes, and Wave Player
runtime behavior. Only after those checks pass may the final commit remove
Supabase code, packages, generated types, configuration, documentation, and
deployment variables.
