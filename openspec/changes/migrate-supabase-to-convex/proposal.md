# Change: Migrate from Supabase to Convex with Clerk Auth

## Why

Current Supabase setup (Auth + Postgres + S3) works but adds complexity with separate auth flows, manual type generation, and limited real-time capabilities. Convex provides a unified reactive backend with end-to-end TypeScript, automatic caching, and simpler DX. Clerk offers superior user management UI and webhook-based sync.

## What Changes

- **BREAKING**: Replace Supabase Auth with Clerk authentication
- **BREAKING**: Replace Supabase Postgres with Convex document database
- **BREAKING**: Replace Supabase S3 storage with Convex file storage
- **BREAKING**: Remove all `db/` service layer code
- **BREAKING**: Remove `supabase/` directory and migrations
- Add Clerk as identity provider with GitHub OAuth
- Add Convex backend with schema, functions, and HTTP endpoints
- Add webhook-based user sync from Clerk to Convex
- Update all components from service layer to Convex hooks
- Migrate existing data (tracks, playlists) to Convex

## Impact

### Affected Specs
- `auth` - Complete replacement of authentication system
- `database` - New backend, schema, and query patterns
- `users` - Webhook-synced user management

### Affected Code

**Directories to remove:**
- `db/` - Entire service layer
- `supabase/` - Migrations and config
- `app/login/` - Supabase auth pages
- `app/auth/` - Supabase auth callbacks

**Directories to create:**
- `convex/` - Backend functions and schema

**Files to modify:**
- `app/layout.tsx` - Add ClerkProvider, ConvexClientProvider
- `middleware.ts` - Replace Supabase middleware with Clerk
- `components/site/site-auth.tsx` - Use Clerk components
- `package.json` - Update dependencies and scripts
- `CLAUDE.md` - Update documentation
- `openspec/project.md` - Update tech stack

### Dependencies

**Remove:**
- `@supabase/ssr`
- `@supabase/supabase-js`
- `supabase` (CLI)

**Add:**
- `convex`
- `@clerk/nextjs`
- `@clerk/backend`
- `svix` (webhook verification)
- `npm-run-all2` (parallel dev scripts)

## Rollback Strategy

1. Keep Supabase instance running during migration
2. Use feature flag (`NEXT_PUBLIC_USE_CONVEX`) to switch backends
3. Test thoroughly before removing Supabase code
4. Maintain data export scripts for emergency rollback
5. Decommission Supabase after 2 weeks stable operation
