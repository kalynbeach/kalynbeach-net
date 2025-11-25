# Tasks: Supabase to Convex Migration

## 1. Setup

- [ ] 1.1 Remove Supabase packages (`@supabase/ssr`, `@supabase/supabase-js`, `supabase`)
- [ ] 1.2 Add Convex and Clerk packages (`convex`, `@clerk/nextjs`, `@clerk/backend`, `svix`)
- [ ] 1.3 Initialize Convex project (`bunx convex dev`)
- [ ] 1.4 Create Clerk application with GitHub OAuth
- [ ] 1.5 Create Clerk JWT template named `convex`
- [ ] 1.6 Configure `.env.local` with Convex and Clerk keys
- [ ] 1.7 Configure Convex environment variables (`CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SECRET`)

## 2. Define Convex Schema

- [ ] 2.1 Create `convex/schema.ts` with tables:
  - [ ] `users` table with `externalId` index
  - [ ] `tracks` table with storage reference
  - [ ] `playlists` table with user index
  - [ ] `playlistTracks` junction table with indexes

## 3. Implement Authentication

- [ ] 3.1 Create `convex/auth.config.ts` for JWT verification
- [ ] 3.2 Create `convex/http.ts` with Clerk webhook endpoint
- [ ] 3.3 Configure Clerk webhook in dashboard (user.created, user.updated, user.deleted)
- [ ] 3.4 Create `middleware.ts` with Clerk route protection

## 4. Convert Services to Convex Functions

- [ ] 4.1 Create `convex/users.ts`:
  - [ ] `current` query
  - [ ] `upsertFromClerk` internal mutation
  - [ ] `deleteFromClerk` internal mutation
  - [ ] Helper functions (`getCurrentUser`, `getCurrentUserOrThrow`, `userByExternalId`)
- [ ] 4.2 Create `convex/tracks.ts`:
  - [ ] `list` query
  - [ ] `get` query
  - [ ] `create` mutation
  - [ ] `update` mutation
  - [ ] `remove` mutation
- [ ] 4.3 Create `convex/playlists.ts`:
  - [ ] `list` query
  - [ ] `get` query
  - [ ] `getWithTracks` query
  - [ ] `create` mutation
  - [ ] `addTrack` mutation
  - [ ] `removeTrack` mutation
- [ ] 4.4 Create `convex/storage.ts`:
  - [ ] `generateUploadUrl` mutation
  - [ ] `getUrl` query

## 5. Update Client Integration

- [ ] 5.1 Update `app/layout.tsx` with ClerkProvider and ConvexClientProvider
- [ ] 5.2 Create `app/convex-client-provider.tsx`
- [ ] 5.3 Create `lib/convex.ts` with server-side auth helper
- [ ] 5.4 Update `components/site/site-auth.tsx` to use Clerk components
- [ ] 5.5 Update components using tracks/playlists to use Convex hooks

## 6. File Storage Migration

- [ ] 6.1 Keep S3 URLs in `src` field during migration
- [ ] 6.2 Create `convex/migrations/migrateS3ToConvex.ts` action
- [ ] 6.3 Migrate existing S3 files to Convex storage
- [ ] 6.4 Update tracks with `fileId` references

## 7. Data Migration

- [ ] 7.1 Create `scripts/export-supabase.ts` export script
- [ ] 7.2 Export tracks, playlists, playlistTracks as JSONL
- [ ] 7.3 Transform data to match Convex schema
- [ ] 7.4 Import data to Convex (`bunx convex import`)

## 8. Update Development Workflow

- [ ] 8.1 Add `npm-run-all2` for parallel dev scripts
- [ ] 8.2 Update `package.json` scripts:
  - [ ] `dev` - parallel next + convex dev
  - [ ] `dev:next` - next dev --turbo
  - [ ] `dev:convex` - convex dev
  - [ ] `convex:deploy` - convex deploy

## 9. Testing and Validation

- [ ] 9.1 Test authentication flow:
  - [ ] Clerk sign-in modal
  - [ ] GitHub OAuth
  - [ ] User creation via webhook
  - [ ] Sign-out
  - [ ] Protected route redirect
- [ ] 9.2 Test authorization:
  - [ ] Admin role check
  - [ ] VIP role check
  - [ ] Guest access
- [ ] 9.3 Test data operations:
  - [ ] Track CRUD
  - [ ] Playlist CRUD
  - [ ] Playlist tracks management
- [ ] 9.4 Test audio playback:
  - [ ] WavePlayer initialization
  - [ ] Convex storage loading
  - [ ] Legacy S3 loading
  - [ ] Play/pause
  - [ ] Track/playlist navigation
- [ ] 9.5 Test all three audio systems:
  - [ ] Refactored sound (`/sound/sound-card`)
  - [ ] Wave-lab (`/sound/wave-lab`)
  - [ ] Wave-player (`/sound/wave-player`)

## 10. Cleanup

- [ ] 10.1 Remove Supabase packages (if not done in 1.1)
- [ ] 10.2 Delete legacy directories:
  - [ ] `db/`
  - [ ] `supabase/`
  - [ ] `app/login/`
  - [ ] `app/auth/`
- [ ] 10.3 Delete legacy files:
  - [ ] `lib/types/database.ts`
  - [ ] `components/site/site-sign-in.tsx`
  - [ ] `components/site/site-sign-out.tsx`
  - [ ] `components/site/site-user.tsx`
- [ ] 10.4 Update documentation:
  - [ ] `README.md`
  - [ ] `CLAUDE.md`
  - [ ] `openspec/project.md`
  - [ ] Rename `docs/DATABASE.md` to `docs/CONVEX.md`
