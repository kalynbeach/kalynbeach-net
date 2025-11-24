# Supabase to Convex Migration Plan

## Overview
This plan outlines a complete migration from Supabase (PostgreSQL + Auth + S3) to Convex (Document DB + Auth + Storage) for the kalynbeach-net Next.js application.

## Phase 1: Setup Convex Project

### 1.1 Install Convex Dependencies
- Install `convex` and `@convex-dev/auth` packages
- Remove Supabase packages (`@supabase/ssr`, `@supabase/supabase-js`)
- Keep `@auth/core` for OAuth providers

### 1.2 Initialize Convex
- Run `bunx convex dev` to create convex directory
- Set up environment variables:
  - `NEXT_PUBLIC_CONVEX_URL`
  - `AUTH_GITHUB_ID` (reuse from Supabase)
  - `AUTH_GITHUB_SECRET` (reuse from Supabase)
  - `SITE_URL` (http://localhost:3000)

## Phase 2: Define Convex Schema

### 2.1 Create `convex/schema.ts`
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  
  // Replaces profiles table (extends auth users)
  profiles: defineTable({
    userId: v.id("users"), // Link to auth users
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("vip"), v.literal("guest")),
  }).index("by_userId", ["userId"]),
  
  // Replaces tracks table
  tracks: defineTable({
    title: v.string(),
    artist: v.string(),
    record: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")), // Convex storage reference
    src: v.optional(v.string()), // Legacy S3 URL during migration
    image: v.optional(v.object({
      src: v.string(),
      alt: v.string(),
    })),
    isLoop: v.boolean(),
  }),
  
  // Replaces playlists table
  playlists: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  }),
  
  // Replaces playlist_tracks junction table
  playlistTracks: defineTable({
    playlistId: v.id("playlists"),
    trackId: v.id("tracks"),
    position: v.number(),
  })
    .index("by_playlist", ["playlistId"])
    .index("by_track", ["trackId"])
    .index("by_playlist_position", ["playlistId", "position"]),
});
```

## Phase 3: Implement Authentication

### 3.1 Create `convex/auth.ts`
```typescript
import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [GitHub],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // Create/update profile when user signs in
      const user = await ctx.db.get(args.userId);
      if (user) {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", q => q.eq("userId", args.userId))
          .first();
        
        if (!profile) {
          await ctx.db.insert("profiles", {
            userId: args.userId,
            name: user.name || "Unknown",
            role: "guest",
          });
        }
      }
      return args.userId;
    }
  }
});
```

### 3.2 Create `convex/http.ts`
```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
```

### 3.3 Update `middleware.ts`
Replace Supabase middleware with Convex Auth middleware:
```typescript
import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

export default convexAuthNextjsMiddleware();

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

### 3.4 Update authentication components
- Replace `SiteAuth` component to use Convex Auth hooks
- Update `SiteUser` component for Convex user data

## Phase 4: Convert Services to Convex Functions

### 4.1 Track Functions (`convex/tracks.ts`)
```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const offset = args.offset ?? 0;
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

### 4.2 Playlist Functions (`convex/playlists.ts`)
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
      .withIndex("by_playlist", q => q.eq("playlistId", args.id))
      .collect();
    
    const tracks = await Promise.all(
      playlistTracks
        .sort((a, b) => a.position - b.position)
        .map(pt => ctx.db.get(pt.trackId))
    );
    
    return { ...playlist, tracks: tracks.filter(Boolean) };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
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
    const position = args.position ?? 
      (await ctx.db
        .query("playlistTracks")
        .withIndex("by_playlist", q => q.eq("playlistId", args.playlistId))
        .collect()).length;
    
    return await ctx.db.insert("playlistTracks", {
      playlistId: args.playlistId,
      trackId: args.trackId,
      position,
    });
  },
});
```

### 4.3 Storage Functions (`convex/storage.ts`)
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

## Phase 5: Update Client Integration

### 5.1 Replace Providers in `app/layout.tsx`
```typescript
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./providers";

export default function RootLayout({ children }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html>
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
```

### 5.2 Create Client Provider (`app/providers.tsx`)
```typescript
"use client";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
```

### 5.3 Update Components to Use Convex Hooks
Example component update:
```typescript
// Before (Supabase)
import { TrackService } from "@/db/services/track-service";
const tracks = await TrackService.list();

// After (Convex)
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
const tracks = useQuery(api.tracks.list);
```

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
        headers: { "Content-Type": blob.type }
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

export const migrateAllTracks = action({
  handler: async (ctx) => {
    const tracks = await ctx.runQuery(api.tracks.list, {});
    for (const track of tracks) {
      if (track.src && !track.fileId) {
        await migrateTrackFile(ctx, { trackId: track._id });
      }
    }
  },
});
```

## Phase 7: Data Migration

### 7.1 Export from Supabase
Create export script (`scripts/export-supabase.js`):
```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function exportData() {
  // Export profiles
  const { data: profiles } = await supabase.from('profiles').select('*');
  
  // Export tracks
  const { data: tracks } = await supabase.from('tracks').select('*');
  
  // Export playlists
  const { data: playlists } = await supabase.from('playlists').select('*');
  
  // Export playlist_tracks
  const { data: playlistTracks } = await supabase.from('playlist_tracks').select('*');
  
  // Save as JSONL for Convex import
  const writeJSONL = (filename, data) => {
    const jsonl = data.map(item => JSON.stringify(item)).join('\n');
    fs.writeFileSync(filename, jsonl);
  };
  
  writeJSONL('profiles.jsonl', profiles);
  writeJSONL('tracks.jsonl', tracks);
  writeJSONL('playlists.jsonl', playlists);
  writeJSONL('playlistTracks.jsonl', playlistTracks);
}

exportData();
```

### 7.2 Import to Convex
```bash
# Import data
bunx convex import --table profiles profiles.jsonl
bunx convex import --table tracks tracks.jsonl
bunx convex import --table playlists playlists.jsonl
bunx convex import --table playlistTracks playlistTracks.jsonl
```

## Phase 8: Update Development Workflow

### 8.1 Update package.json scripts
```json
{
  "scripts": {
    "dev": "concurrently \"next dev --turbo\" \"convex dev\"",
    "build": "next build && convex deploy",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "format": "bunx prettier . --write",
    "format:check": "bunx prettier . --check",
    "convex:dev": "convex dev",
    "convex:deploy": "convex deploy",
    "convex:import": "convex import"
  }
}
```

### 8.2 Update Environment Variables
`.env.local`:
```bash
# Remove these
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Add these
NEXT_PUBLIC_CONVEX_URL=https://...convex.cloud
CONVEX_DEPLOYMENT=...

# Keep these (from Supabase)
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
SITE_URL=http://localhost:3000
```

## Phase 9: Testing and Validation

### 9.1 Test Authentication Flow
- [ ] GitHub OAuth sign-in
- [ ] GitHub OAuth sign-out
- [ ] Protected route access (/dashboard)
- [ ] User profile creation on first sign-in
- [ ] Role assignment and permissions

### 9.2 Test Data Operations
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
- [ ] Reorder tracks in playlist

### 9.3 Test Audio Playback
- [ ] WavePlayer initialization
- [ ] Audio file loading from Convex storage
- [ ] Audio file loading from S3 (legacy)
- [ ] Play/pause functionality
- [ ] Track switching
- [ ] Playlist navigation
- [ ] Loop functionality

### 9.4 Test Three Audio Systems
- [ ] Refactored sound system (/sound/sound-card)
- [ ] Wave-lab system (/sound/wave-lab)
- [ ] Wave-player system (/sound/wave-player)

## Phase 10: Cleanup

### 10.1 Remove Supabase Dependencies
```bash
bun remove @supabase/ssr @supabase/supabase-js supabase
```

### 10.2 Remove Legacy Code
- Delete `db/supabase` directory
- Delete `db/services` directory (BaseService pattern)
- Delete `db/queries` directory
- Remove Supabase types from `lib/types/database.ts`
- Remove `supabase` directory

### 10.3 Update Documentation
- Update README.md with Convex setup instructions
- Update CLAUDE.md:
  - Remove Supabase commands
  - Add Convex commands
  - Update architecture description
- Update docs/DATABASE.md → docs/CONVEX.md
- Remove docs/AUTH.md (outdated Supabase auth docs)

## Migration Timeline

- **Week 1**: Phases 1-3 (Setup, Schema, Auth)
  - Day 1-2: Install dependencies, initialize Convex
  - Day 3-4: Define schema, implement auth
  - Day 5: Test auth flow

- **Week 2**: Phases 4-5 (Functions, Client)
  - Day 1-2: Convert services to Convex functions
  - Day 3-4: Update client components
  - Day 5: Integration testing

- **Week 3**: Phases 6-7 (Storage, Data Migration)
  - Day 1-2: Implement storage migration
  - Day 3-4: Export/import data
  - Day 5: Verify data integrity

- **Week 4**: Phases 8-10 (Testing, Cleanup, Documentation)
  - Day 1-2: Comprehensive testing
  - Day 3-4: Remove legacy code
  - Day 5: Update documentation

## Rollback Strategy

Keep Supabase instance running during migration:

1. **Feature Flags**: Use environment variable to switch between backends
```typescript
const USE_CONVEX = process.env.NEXT_PUBLIC_USE_CONVEX === 'true';

if (USE_CONVEX) {
  // Use Convex hooks/functions
} else {
  // Use Supabase services
}
```

2. **Data Sync**: Maintain bi-directional sync during transition
3. **Gradual Rollout**: Test with subset of users first
4. **Backup**: Export Convex data regularly during migration
5. **Monitoring**: Track errors and performance metrics
6. **Decommission**: Only remove Supabase after 2 weeks of stable operation

## Key Benefits After Migration

1. **Simplified Stack**: Single backend platform for database, auth, and storage
2. **Real-time by Default**: Automatic reactivity without additional setup
3. **Type Safety**: End-to-end TypeScript with generated types
4. **Better DX**: Simpler API, automatic caching, built-in optimistic updates
5. **Cost Efficiency**: Unified billing, no separate S3 costs
6. **Performance**: Edge caching, automatic query optimization
7. **Scalability**: Automatic scaling without configuration

## Potential Challenges and Solutions

### Challenge 1: PostgreSQL to Document DB
- **Issue**: Loss of relational features (JOINs, foreign keys)
- **Solution**: Use indexes and denormalization where needed

### Challenge 2: File Size Limits
- **Issue**: Convex has file size limits
- **Solution**: Stream large audio files or use chunking

### Challenge 3: Query Patterns
- **Issue**: Different query syntax and capabilities
- **Solution**: Redesign complex queries to fit document model

### Challenge 4: Existing User Sessions
- **Issue**: Users will be logged out during migration
- **Solution**: Announce maintenance window, provide clear communication

## Post-Migration Optimizations

1. **Implement Convex Functions for audio processing**
2. **Add real-time collaboration features**
3. **Implement optimistic updates for better UX**
4. **Add WebSocket-based live audio streaming**
5. **Implement server-side rendering with Convex**
6. **Add analytics using Convex scheduled functions**

## Resources

- [Convex Documentation](https://docs.convex.dev)
- [Convex Auth Documentation](https://labs.convex.dev/auth)
- [Convex Migration Guide](https://docs.convex.dev/database/migrations)
- [Next.js + Convex Example](https://github.com/get-convex/convex-demos)