# Convex production cutover

This runbook intentionally separates preview setup from the production data
migration. Do not run production commands from a Vercel preview or with a
preview deploy key.

## Preview deployment

The Vercel project currently has neither required deploy key. Do not apply the
shared build-command override until both environment-scoped keys are installed:

1. In the Convex project defaults for new preview deployments, set
   `CLERK_JWT_ISSUER_DOMAIN`. Also set `INITIAL_ADMIN_CLERK_USER_ID` there when
   preview verification must cover dashboard and lab admin access. Values set
   only on development deployment `hardy-pheasant-300` are not inherited by
   fresh previews.
2. On production deployment `beloved-butterfly-26`, set
   `CLERK_JWT_ISSUER_DOMAIN` and `INITIAL_ADMIN_CLERK_USER_ID` before deploying
   functions or testing authenticated routes.
3. Add the Clerk publishable and secret keys to each Vercel environment that
   will run the app. Preview currently has the publishable key but is missing
   `CLERK_SECRET_KEY`; Production Clerk/Vercel values are not yet configured for
   runtime verification. Keep development, Preview, and Production values
   scoped to their intended environments.
4. Generate a Convex Preview Deploy Key and add it to Vercel as
   `CONVEX_DEPLOY_KEY`, scoped only to Preview.
5. From the Convex production deployment, generate a Production Deploy Key
   with `deployment:deploy` permission and add it to Vercel as
   `CONVEX_DEPLOY_KEY`, scoped only to Production.
6. After both keys and the auth environment values exist, use this Vercel Build
   Command:

   ```sh
   bunx convex deploy --cmd 'bun run build' --preview-run 'migrations:seedPreview'
   ```

`migrations:seedPreview` is an internal mutation. It validates and upserts the
two deterministic S3-backed tracks and their playlist by stable public IDs. It
does not delete unrelated rows, and Convex ignores `--preview-run` for
production deployments.

## Production migration

The exact production target is `beloved-butterfly-26`, not the development
deployment `hardy-pheasant-300`. The export command refuses to make a Supabase
request or write local files unless both guard values are exact, and it refuses
to reuse an existing output directory:

```sh
MIGRATION_TARGET=beloved-butterfly-26 \
MIGRATION_CONFIRM=EXPORT_SUPABASE_PRODUCTION_TO_CONVEX \
bun --env-file=/absolute/path/to/production-migration.env \
  run migration:export:production -- \
  --output /private/tmp/kalynbeach-net-convex-production
```

The secure environment file must provide `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The exporter fetches only `tracks`, `playlists`,
and `playlist_tracks`; normalizes nullable fields; validates IDs, HTTPS track
URLs, references, and positions; then writes JSONL plus a count manifest.

Before any import, deploy the reviewed Convex schema/functions to production
and inspect the manifest and production tables. The guarded runner requires the
exact deployment name, a separate typed confirmation, the validated manifest
and JSONL files, and an explicit `append` mode:

```sh
MIGRATION_TARGET=beloved-butterfly-26 \
MIGRATION_CONFIRM=IMPORT_VALIDATED_DATA_TO_CONVEX_PRODUCTION \
bun run migration:import:production -- \
  --input /private/tmp/kalynbeach-net-convex-production \
  --mode append
```

The runner invokes Convex with `--deployment beloved-butterfly-26`; it does not
infer production from a development deployment. Before each table append, it
reads the target table. An empty table can be imported; an exact match is
treated as already complete; any other non-empty state stops the run. After
each append it reads the table again, requires an exact match, and atomically
updates `production-import-state.json` in the input directory.

This makes a safe resume possible after a process interruption: rerun the same
guarded command, and verified tables are skipped. If a table contains a partial
or unmatched import, do not rerun or use `--replace`; reconcile or restore that
table manually, verify it against the JSONL file, then resume. `--replace`
requires a separately approved destructive migration and is not supported by
the runner.

After import, verify production counts, public track/playlist projections, S3
URLs, and Wave Player behavior before removing any Supabase code, dependencies,
configuration, or deployment variables.
