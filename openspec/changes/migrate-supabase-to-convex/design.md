# Design: Supabase to Convex Migration

## Context

Current stack uses Supabase for auth, Postgres database, and S3 storage. This requires:
- Separate auth flow management
- Manual TypeScript type generation from SQL
- Complex middleware for auth state
- Separate storage bucket configuration

Migration to Convex + Clerk simplifies the stack with:
- Webhook-based user sync (Clerk → Convex)
- End-to-end TypeScript with generated types
- Automatic reactivity and caching
- Built-in file storage

## Goals / Non-Goals

**Goals:**
- Replace Supabase with Convex + Clerk
- Maintain all existing functionality (tracks, playlists, auth)
- Improve developer experience
- Enable real-time updates
- Preserve all three audio systems

**Non-Goals:**
- Refactoring audio systems (separate concern)
- Adding new features during migration
- Changing UI/UX patterns
- Multi-tenant architecture

## Decisions

### Decision: Clerk as Auth Provider

Clerk provides:
- Managed user authentication with OAuth
- Pre-built UI components
- Webhook-based sync to backend
- Superior user management dashboard

**Alternative considered**: Convex Auth
- Rejected: Less mature, fewer OAuth providers, no user management UI

### Decision: Webhook-Based User Sync

Users synced via Clerk webhooks to Convex `users` table:
```
Clerk (user.created) → HTTP endpoint → Convex mutation → users table
```

**Alternative considered**: Client-side user creation
- Rejected: Race conditions, requires client to wait, less reliable

### Decision: Single `users` Table (Not `profiles`)

Clean break from Supabase naming. Clerk is source of truth for identity; Convex stores app-specific data.

Schema:
```typescript
users: defineTable({
  name: v.string(),
  email: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  externalId: v.string(), // Clerk user ID
  role: v.union(v.literal("admin"), v.literal("vip"), v.literal("guest")),
}).index("byExternalId", ["externalId"])
```

### Decision: Dual Storage During Migration

Keep `src` (S3 URL) and add `fileId` (Convex storage) fields on tracks:
```typescript
tracks: defineTable({
  // ...
  fileId: v.optional(v.id("_storage")), // New: Convex storage
  src: v.optional(v.string()),          // Legacy: S3 URL
})
```

Allows gradual file migration without breaking existing tracks.

### Decision: Parallel Dev Scripts

Use `npm-run-all2` to run Next.js and Convex dev servers simultaneously:
```json
{
  "dev": "npm-run-all --parallel dev:next dev:convex",
  "dev:next": "next dev --turbo",
  "dev:convex": "convex dev"
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│  ┌─────────────┐    ┌──────────────────────────────────┐    │
│  │ClerkProvider│───▶│ ConvexProviderWithClerk          │    │
│  │ (auth state)│    │ (reactive queries/mutations)     │    │
│  └─────────────┘    └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       CONVEX BACKEND                        │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐     │
│  │ auth.config │    │  users.ts   │    │  http.ts     │     │
│  │ (JWT verify)│    │ (user CRUD) │    │ (webhooks)   │     │
│  └─────────────┘    └─────────────┘    └──────────────┘     │
│                              ▲                   ▲          │
└──────────────────────────────│───────────────────│──────────┘
                               │                   │
                    ┌──────────┴───────────────────┴──────────┐
                    │              CLERK                      │
                    │  ┌─────────┐  ┌──────────────────────┐  │
                    │  │ OAuth   │  │ Webhooks             │  │
                    │  │ (GitHub)│  │ user.created/updated │  │
                    │  └─────────┘  └──────────────────────┘  │
                    └─────────────────────────────────────────┘
```

## Data Flow

### Authentication Flow
1. User clicks sign-in → Clerk modal opens
2. User authenticates via GitHub OAuth
3. Clerk creates/updates user record
4. Clerk sends webhook to Convex HTTP endpoint
5. Convex `upsertFromClerk` mutation creates/updates `users` row
6. Client receives JWT with `subject` = Clerk user ID
7. Convex queries use `ctx.auth.getUserIdentity()` to get current user

### Query Flow (Client)
```typescript
// Before (Supabase service layer)
const tracks = await TrackService.list();

// After (Convex reactive hook)
const tracks = useQuery(api.tracks.list);
```

### Mutation Flow (Client)
```typescript
// Before (Supabase)
await TrackService.create({ title, artist });

// After (Convex)
const createTrack = useMutation(api.tracks.create);
await createTrack({ title, artist });
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Export scripts, backup before import |
| Webhook delivery failures | Svix retry logic, manual sync endpoint |
| S3 files become inaccessible | Keep S3 bucket active until migration complete |
| Auth flow breaks | Feature flag to toggle between backends |
| Convex cold starts | Acceptable for personal site traffic |

## Migration Plan

### Phase Order (Critical Path)
1. **Setup** - Install deps, configure services
2. **Schema** - Define Convex tables
3. **Auth** - Implement Clerk + webhooks (unblocks everything)
4. **Functions** - Create Convex queries/mutations
5. **Client** - Update providers and components
6. **Data** - Export Supabase, import to Convex
7. **Storage** - Migrate S3 files (can be gradual)
8. **Test** - Validate all functionality
9. **Cleanup** - Remove Supabase code

### Rollback Points
- After Phase 3: Can revert to Supabase auth
- After Phase 5: Feature flag switches backends
- After Phase 6: Data exists in both systems
- After Phase 9: Point of no return

## Open Questions

1. Should admin role assignment move to Clerk custom claims or stay in Convex? **Just stay in Convex, for now.**
2. Keep Supabase project for analytics/future use or fully decommission? **Fully decommission Supabase project.**
3. Migrate all S3 files immediately or lazy-migrate on access? **Migrate all S3 files immediately.**
