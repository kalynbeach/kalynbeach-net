# Supabase to Convex Migration Plan

> Generated: 2025-11-24
>
> Model: Claude Opus 4.5 (Claude Code)

## Overview

This plan outlines a complete migration from Supabase (PostgreSQL + Auth + S3) to Convex (Document DB + Storage) with Clerk for authentication and user management.

### Architecture

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

### Key Principles

- **Clerk-Primary**: Clerk is the source of truth for user identity and authentication
- **Webhook Sync**: Convex `users` table synced via Clerk webhooks (not client-side mutations)
- **Clean Break**: Use `users` table (not `profiles`) - no Supabase naming conventions

### Target Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Bun | latest |
| Framework | Next.js | ^16.0.3 |
| React | React | ^19.2.0 |
| Backend | Convex | ^1.29.3 |
| Auth | Clerk | ^6.35.2 |
| Styling | Tailwind CSS | ^4.1.17 |

---

## Phase 1: Setup

### 1.1 Install Dependencies

```bash
# Remove Supabase packages
bun remove @supabase/ssr @supabase/supabase-js supabase

# Add Convex and Clerk packages
bun add convex @clerk/nextjs @clerk/backend svix
```

### 1.2 Initialize Convex

```bash
bunx convex dev
```

This creates the `convex/` directory and prompts for project setup.

### 1.3 Set Up Clerk

1. Create Clerk application at [clerk.com](https://clerk.com)
2. Enable GitHub OAuth provider in Clerk Dashboard
3. Create JWT Template:
   - Navigate to **JWT Templates** → **New Template**
   - Name: `convex` (exact name required)
   - Use default claims
   - Copy the **Issuer URL** (e.g., `https://verb-noun-00.clerk.accounts.dev`)
4. Set up webhook endpoint (see Phase 3)

### 1.4 Environment Variables

**`.env.local`** (local development):
```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

**Convex Dashboard** (Settings → Environment Variables):
```bash
CLERK_JWT_ISSUER_DOMAIN=https://verb-noun-00.clerk.accounts.dev
CLERK_WEBHOOK_SECRET=whsec_...
```

---

## Phase 2: Define Convex Schema

### 2.1 Create `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table - synced from Clerk via webhooks
  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    externalId: v.string(), // Clerk user ID
    role: v.union(v.literal("admin"), v.literal("vip"), v.literal("guest")),
  }).index("byExternalId", ["externalId"]),

  // Tracks table
  tracks: defineTable({
    title: v.string(),
    artist: v.string(),
    record: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")), // Convex storage reference
    src: v.optional(v.string()), // Legacy S3 URL during migration
    image: v.optional(
      v.object({
        src: v.string(),
        alt: v.string(),
      })
    ),
    isLoop: v.boolean(),
  }),

  // Playlists table
  playlists: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  }).index("byUserId", ["userId"]),

  // Playlist tracks junction table
  playlistTracks: defineTable({
    playlistId: v.id("playlists"),
    trackId: v.id("tracks"),
    position: v.number(),
  })
    .index("byPlaylist", ["playlistId"])
    .index("byTrack", ["trackId"])
    .index("byPlaylistPosition", ["playlistId", "position"]),
});
```

---

## Phase 3: Implement Authentication

### 3.1 Create `convex/auth.config.ts`

```typescript
import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

### 3.2 Create `convex/http.ts` (Webhook Endpoint)

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) {
      return new Response("Invalid webhook", { status: 400 });
    }

    switch (event.type) {
      case "user.created":
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });
        break;
      case "user.deleted": {
        const clerkUserId = event.data.id!;
        await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
        break;
      }
      default:
        console.log("Ignored Clerk webhook event", event.type);
    }

    return new Response(null, { status: 200 });
  }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook event", error);
    return null;
  }
}

export default http;
```

### 3.3 Configure Clerk Webhook

1. Go to Clerk Dashboard → **Webhooks** → **Add Endpoint**
2. **Endpoint URL**: `https://<your-deployment>.convex.site/clerk-users-webhook`
   - Note: Use `.convex.site` (not `.convex.cloud`)
3. **Subscribe to events**:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy **Signing Secret** (starts with `whsec_`)
5. Add as `CLERK_WEBHOOK_SECRET` in Convex Dashboard

### 3.4 Create `middleware.ts`

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

---

## Phase 4: Convert Services to Convex Functions

### 4.1 User Functions (`convex/users.ts`)

```typescript
import { internalMutation, query, QueryCtx } from "./_generated/server";
import type { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";

// Public query - get current user
export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

// Internal mutation - called by webhook on user.created/user.updated
export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> },
  async handler(ctx, { data }) {
    const userAttributes = {
      name:
        `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || "Unknown",
      email: data.email_addresses?.[0]?.email_address,
      imageUrl: data.image_url,
      externalId: data.id,
      role: "guest" as const,
    };

    const existingUser = await userByExternalId(ctx, data.id);
    if (existingUser === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      // Preserve existing role on updates
      const { role: _role, ...updateAttrs } = userAttributes;
      await ctx.db.patch(existingUser._id, updateAttrs);
    }
  },
});

// Internal mutation - called by webhook on user.deleted
export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId);
    if (user !== null) {
      await ctx.db.delete(user._id);
    } else {
      console.warn(
        `Can't delete user, none found for Clerk ID: ${clerkUserId}`
      );
    }
  },
});

// Helper: get current authenticated user
export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  return await userByExternalId(ctx, identity.subject);
}

// Helper: get current user or throw
export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Unauthenticated");
  return user;
}

// Helper: query user by Clerk external ID
async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
    .unique();
}
```

### 4.2 Track Functions (`convex/tracks.ts`)

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db.query("tracks").take(limit);
  },
});

export const get = query({
  args: { id: v.id("tracks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    artist: v.string(),
    record: v.optional(v.string()),
    isLoop: v.boolean(),
    fileId: v.optional(v.id("_storage")),
    src: v.optional(v.string()),
    image: v.optional(
      v.object({
        src: v.string(),
        alt: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tracks", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("tracks"),
    title: v.optional(v.string()),
    artist: v.optional(v.string()),
    record: v.optional(v.string()),
    isLoop: v.optional(v.boolean()),
    fileId: v.optional(v.id("_storage")),
    src: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("tracks") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.id);
  },
});
```

### 4.3 Playlist Functions (`convex/playlists.ts`)

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("playlists").collect();
  },
});

export const get = query({
  args: { id: v.id("playlists") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getWithTracks = query({
  args: { id: v.id("playlists") },
  handler: async (ctx, args) => {
    const playlist = await ctx.db.get(args.id);
    if (!playlist) return null;

    const playlistTracks = await ctx.db
      .query("playlistTracks")
      .withIndex("byPlaylist", (q) => q.eq("playlistId", args.id))
      .collect();

    const tracks = await Promise.all(
      playlistTracks
        .sort((a, b) => a.position - b.position)
        .map((pt) => ctx.db.get(pt.trackId))
    );

    return { ...playlist, tracks: tracks.filter(Boolean) };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("playlists", args);
  },
});

export const addTrack = mutation({
  args: {
    playlistId: v.id("playlists"),
    trackId: v.id("tracks"),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const position =
      args.position ??
      (
        await ctx.db
          .query("playlistTracks")
          .withIndex("byPlaylist", (q) => q.eq("playlistId", args.playlistId))
          .collect()
      ).length;

    return await ctx.db.insert("playlistTracks", {
      playlistId: args.playlistId,
      trackId: args.trackId,
      position,
    });
  },
});

export const removeTrack = mutation({
  args: {
    playlistId: v.id("playlists"),
    trackId: v.id("tracks"),
  },
  handler: async (ctx, args) => {
    const playlistTrack = await ctx.db
      .query("playlistTracks")
      .withIndex("byPlaylist", (q) => q.eq("playlistId", args.playlistId))
      .filter((q) => q.eq(q.field("trackId"), args.trackId))
      .first();

    if (playlistTrack) {
      await ctx.db.delete(playlistTrack._id);
    }
  },
});
```

### 4.4 Storage Functions (`convex/storage.ts`)

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
```

---

## Phase 5: Update Client Integration

### 5.1 Update `app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "./convex-client-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "kalynbeach.net",
  description: "Kalyn Beach's personal website",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider dynamic>
      <html lang="en" suppressHydrationWarning>
        <body>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

### 5.2 Create `app/convex-client-provider.tsx`

```typescript
"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/nextjs";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
```

### 5.3 Create `lib/convex.ts` (Server-side Auth Helper)

```typescript
import { auth } from "@clerk/nextjs/server";

export async function getConvexToken() {
  const { getToken } = await auth();
  return (await getToken({ template: "convex" })) ?? undefined;
}
```

### 5.4 Update Auth Components

Replace `components/site/site-auth.tsx`:

```typescript
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export function SiteAuth() {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="text-sm font-medium hover:underline">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </>
  );
}
```

### 5.5 Update Components to Use Convex Hooks

```typescript
// Before (Supabase)
import { TrackService } from "@/db/services/track-service";
const tracks = await TrackService.list();

// After (Convex)
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
const tracks = useQuery(api.tracks.list);
```

---

## Phase 6: File Storage Migration

### 6.1 Migration Strategy

1. Keep S3 URLs temporarily in `src` field
2. Add upload functionality to store new files in Convex
3. Gradually migrate existing S3 files to Convex storage
4. Update `fileId` field for migrated files

### 6.2 Create Migration Action (`convex/migrations/migrateS3ToConvex.ts`)

```typescript
import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const migrateTrackFile = action({
  args: { trackId: v.id("tracks") },
  handler: async (ctx, args) => {
    const track = await ctx.runQuery(api.tracks.get, { id: args.trackId });
    if (track?.src && !track.fileId) {
      // Fetch from S3
      const response = await fetch(track.src);
      const blob = await response.blob();

      // Upload to Convex
      const uploadUrl = await ctx.runMutation(api.storage.generateUploadUrl);
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: blob,
        headers: { "Content-Type": blob.type },
      });

      const { storageId } = await uploadResponse.json();

      // Update track with fileId
      await ctx.runMutation(api.tracks.update, {
        id: args.trackId,
        fileId: storageId,
      });
    }
  },
});
```

---

## Phase 7: Data Migration

### 7.1 Export from Supabase

Create export script (`scripts/export-supabase.ts`):

```typescript
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function exportData() {
  // Export tracks
  const { data: tracks } = await supabase.from("tracks").select("*");

  // Export playlists
  const { data: playlists } = await supabase.from("playlists").select("*");

  // Export playlist_tracks
  const { data: playlistTracks } = await supabase
    .from("playlist_tracks")
    .select("*");

  // Save as JSONL for Convex import
  const writeJSONL = (filename: string, data: unknown[]) => {
    const jsonl = data.map((item) => JSON.stringify(item)).join("\n");
    writeFileSync(filename, jsonl);
  };

  if (tracks) writeJSONL("tracks.jsonl", tracks);
  if (playlists) writeJSONL("playlists.jsonl", playlists);
  if (playlistTracks) writeJSONL("playlistTracks.jsonl", playlistTracks);

  console.log("Export complete!");
}

exportData();
```

**Note**: Skip user/profile export - users will re-register via Clerk.

### 7.2 Import to Convex

```bash
# Import data (after transforming to match new schema)
bunx convex import --table tracks tracks.jsonl
bunx convex import --table playlists playlists.jsonl
bunx convex import --table playlistTracks playlistTracks.jsonl
```

---

## Phase 8: Update Development Workflow

### 8.1 Update `package.json` Scripts

```json
{
  "scripts": {
    "dev": "npm-run-all --parallel dev:next dev:convex",
    "dev:next": "next dev --turbo",
    "dev:convex": "convex dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "format": "bunx prettier . --write",
    "format:check": "bunx prettier . --check",
    "convex:deploy": "convex deploy"
  }
}
```

### 8.2 Add `npm-run-all` for Parallel Dev

```bash
bun add -D npm-run-all2
```

---

## Phase 9: Testing and Validation

### 9.1 Test Authentication Flow

- [ ] Clerk sign-in modal appears
- [ ] GitHub OAuth flow completes
- [ ] User created in Convex via webhook on first sign-in
- [ ] User data updates sync via webhook
- [ ] Sign-out clears session
- [ ] Protected route `/dashboard` redirects unauthenticated users

### 9.2 Test Authorization

- [ ] Admin role check works (manually assign in Convex Dashboard)
- [ ] VIP role check works
- [ ] Guest users have appropriate access

### 9.3 Test Data Operations

- [ ] List all tracks
- [ ] Get single track
- [ ] Create new track
- [ ] Update track
- [ ] Delete track
- [ ] List all playlists
- [ ] Get playlist with tracks
- [ ] Create playlist
- [ ] Add track to playlist
- [ ] Remove track from playlist

### 9.4 Test Audio Playback

- [ ] WavePlayer initialization
- [ ] Audio file loading from Convex storage
- [ ] Audio file loading from S3 (legacy)
- [ ] Play/pause functionality
- [ ] Track switching
- [ ] Playlist navigation

### 9.5 Test Three Audio Systems

- [ ] Refactored sound system (`/sound/sound-card`)
- [ ] Wave-lab system (`/sound/wave-lab`)
- [ ] Wave-player system (`/sound/wave-player`)

---

## Phase 10: Cleanup

### 10.1 Remove Supabase Dependencies

```bash
bun remove @supabase/ssr @supabase/supabase-js supabase
```

### 10.2 Remove Legacy Code

**Delete directories:**

- `db/supabase/`
- `db/services/`
- `db/queries/`
- `supabase/`
- `app/login/`
- `app/auth/`

**Delete files:**

- `lib/types/database.ts`
- `components/site/site-sign-in.tsx`
- `components/site/site-sign-out.tsx`
- `components/site/site-user.tsx`

### 10.3 Update Documentation

- Update `README.md` with Convex + Clerk setup instructions
- Update `CLAUDE.md`:
  - Remove Supabase commands
  - Add Convex commands
  - Update architecture description
- Rename `docs/DATABASE.md` → `docs/CONVEX.md`

---

## Files Summary

### Files to Create

| File                              | Purpose                          |
| --------------------------------- | -------------------------------- |
| `convex/schema.ts`                | Database schema                  |
| `convex/auth.config.ts`           | Clerk JWT verification           |
| `convex/http.ts`                  | Webhook endpoint                 |
| `convex/users.ts`                 | User management functions        |
| `convex/tracks.ts`                | Track CRUD functions             |
| `convex/playlists.ts`             | Playlist CRUD functions          |
| `convex/storage.ts`               | File storage functions           |
| `app/convex-client-provider.tsx`  | Convex + Clerk client provider   |
| `lib/convex.ts`                   | Server-side auth helpers         |
| `middleware.ts`                   | Clerk route protection           |

### Files to Modify

| File                           | Changes                                    |
| ------------------------------ | ------------------------------------------ |
| `app/layout.tsx`               | Add ClerkProvider, ConvexClientProvider    |
| `components/site/site-auth.tsx`| Replace with Clerk components              |
| `package.json`                 | Update scripts and dependencies            |

### Files to Delete

| File/Directory                     | Reason                        |
| ---------------------------------- | ----------------------------- |
| `db/`                              | Replaced by Convex functions  |
| `supabase/`                        | No longer needed              |
| `app/login/`                       | Clerk handles sign-in         |
| `app/auth/`                        | Clerk handles callbacks       |
| `lib/types/database.ts`            | Supabase types                |
| `components/site/site-sign-in.tsx` | Clerk components replace      |
| `components/site/site-sign-out.tsx`| Clerk components replace      |
| `components/site/site-user.tsx`    | Clerk UserButton replaces     |

---

## Rollback Strategy

Keep Supabase instance running during migration:

1. **Feature Flags**: Use environment variable to switch between backends

```typescript
const USE_CONVEX = process.env.NEXT_PUBLIC_USE_CONVEX === "true";
```

2. **Gradual Rollout**: Test thoroughly before removing Supabase
3. **Backup**: Export Convex data regularly during migration
4. **Monitoring**: Track errors and performance metrics
5. **Decommission**: Only remove Supabase after 2 weeks of stable operation

---

## Key Benefits After Migration

1. **Simplified Stack**: Convex for database + storage, Clerk for auth
2. **Real-time by Default**: Automatic reactivity without additional setup
3. **Type Safety**: End-to-end TypeScript with generated types
4. **Better DX**: Simpler API, automatic caching, built-in optimistic updates
5. **User Management**: Clerk provides robust user management UI
6. **Webhook Sync**: User data automatically synced to Convex
7. **Scalability**: Both Convex and Clerk handle scaling automatically

---

## Resources

- [Convex Documentation](https://docs.convex.dev)
- [Convex + Clerk Integration](https://docs.convex.dev/auth/clerk)
- [Convex Database Auth](https://docs.convex.dev/auth/database-auth)
- [Clerk Next.js Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart)
- [Convex + Clerk Webhooks Demo](https://github.com/get-convex/convex-demos/tree/main/users-and-clerk-webhooks)
- [Next.js + Clerk Template](https://github.com/get-convex/templates/tree/main/template-nextjs-clerk)
