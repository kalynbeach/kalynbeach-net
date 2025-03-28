# Database

## Overview

This project uses Supabase PostgreSQL database as the backend data store. The database is structured around three main tables:

- `users`: Stores user information
- `tracks`: Stores audio track metadata (with audio files in AWS S3)
- `playlists`: Stores playlist information
- `playlist_tracks`: Junction table linking tracks to playlists with position ordering

The database supports a music player system (WavePlayer) that allows users to play and organize tracks into playlists.

## Schema

### Main Tables

**users**
```
id: number (PK)
created_at: timestamp
email: string
role: enum (admin, vip, guest)
```

**tracks**
```
id: number (PK)
created_at: timestamp
title: string
artist: string
record: string (nullable)
src: string (URL to audio file in S3)
image: json (nullable)
isLoop: boolean
```

**playlists**
```
id: number (PK)
created_at: timestamp
title: string
description: string (nullable)
```

**playlist_tracks** (Junction table)
```
id: number (PK)
playlist_id: number (FK -> playlists.id)
track_id: number (FK -> tracks.id)
position: number
created_at: timestamp
```

### Relationships

- A track can belong to multiple playlists (many-to-many relationship)
- A playlist can contain multiple tracks (many-to-many relationship)
- The `playlist_tracks` table maintains the track position within a playlist
- ON DELETE CASCADE is set up to automatically remove playlist-track associations when either a playlist or track is deleted

## Development Workflow

### Local Development

1. **Initialize Supabase Project**
   ```bash
   supabase init
   ```

2. **Start Local Supabase**
   ```bash
   supabase start
   ```

3. **Access Local Supabase**
   - Studio: http://localhost:54323
   - Database: postgresql://postgres:postgres@localhost:54322/postgres
   - API: http://localhost:54321

4. **Create Migrations**

   You can create migrations in two ways:

   a. Manually create a migration file:
   ```bash
   supabase migration new <migration_name>
   ```
   Then edit the SQL file in the `supabase/migrations` directory.

   b. Generate a migration from schema changes:
   ```bash
   supabase db diff --use-migra <migration_name> -f <migration_name>
   ```

5. **Apply Migrations Locally**
   ```bash
   supabase db push
   ```

6. **Generate TypeScript Types**
   ```bash
   supabase gen types typescript --linked > lib/types/database.ts
   ```

### Remote Development

1. **Link Local Project to Remote**
   ```bash
   supabase link --project-ref <your-project-ref>
   ```

2. **Push Local Migrations to Remote**
   ```bash
   supabase db push
   ```

3. **Pull Remote Schema Changes (if any)**
   ```bash
   supabase db pull
   ```

4. **Reset Local Database (if needed)**
   ```bash
   supabase db reset
   ```

5. **Fetch Remote Migration History**
   ```bash
   supabase db remote commit
   ```

## Project Architecture

### Database Access

The project uses a structured approach to database access:

1. **Base Service**
   - Located at `db/services/base-service.ts`
   - Provides common functionality (error handling, logging)
   - Creates and manages Supabase client instances

2. **Specialized Services**
   - `TrackService`: Operations for tracks (`db/services/track-service.ts`)
   - `PlaylistService`: Operations for playlists (`db/services/playlist-service.ts`)
   - Services use React's `cache()` for efficient server components

3. **Query Functions**
   - Located in `db/queries` directory
   - Map database entities to application models
   - Provide a clean API for components to access data

4. **TypeScript Types**
   - Database types in `lib/types/database.ts`
   - Application types in `lib/types/wave-player.d.ts`
   - Type safety throughout the application

### Example: Playlist with Tracks Relationship

To get a playlist with its tracks:

```typescript
import { getPlaylist } from "@/db/queries/playlists";

// In a server component
const playlist = await getPlaylist(1);
```

## Best Practices

1. **Migrations**
   - Create atomic migrations that can be applied independently
   - Use descriptive names for migration files
   - Add comments to complex SQL operations
   - Test migrations locally before pushing to production

2. **Type Safety**
   - Always regenerate types after schema changes
   - Use the generated types consistently throughout the application
   - Validate data at the boundaries (client <-> server)

3. **Services**
   - Keep services focused on a single responsibility
   - Use caching for frequently accessed data
   - Handle errors consistently
   - Use RLS (Row Level Security) for data access control

4. **Performance**
   - Create indexes for frequently queried columns
   - Consider pagination for large data sets
   - Use proper JOIN operations instead of multiple queries

5. **Security**
   - Use RLS policies to restrict data access
   - Never trust client-side data
   - Set up appropriate database roles and permissions
   - Sanitize inputs to prevent SQL injection

## Common Tasks

### Adding a New Table

1. Create a migration:
   ```bash
   supabase migration new create_table_name
   ```

2. Write SQL in the migration file:
   ```sql
   CREATE TABLE table_name (
     id SERIAL PRIMARY KEY,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     -- other columns
   );
   ```

3. Apply the migration:
   ```bash
   supabase db push
   ```

4. Generate types:
   ```bash
   supabase gen types typescript --linked > lib/types/database.ts
   ```

### Creating a Many-to-Many Relationship

1. Create a junction table migration with foreign keys:
   ```sql
   CREATE TABLE table_a_table_b (
     id SERIAL PRIMARY KEY,
     table_a_id INTEGER NOT NULL REFERENCES table_a(id) ON DELETE CASCADE,
     table_b_id INTEGER NOT NULL REFERENCES table_b(id) ON DELETE CASCADE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     UNIQUE(table_a_id, table_b_id)
   );
   ```

2. Apply migration and generate types as above.

3. Create service methods to query the relationship.

### Using Database Functions

1. Create a migration for the function:
   ```sql
   CREATE OR REPLACE FUNCTION function_name(arg1 type, arg2 type)
   RETURNS return_type AS $$
   BEGIN
     -- function body
     RETURN result;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. Call the function from your service:
   ```typescript
   const { data, error } = await supabase
     .rpc('function_name', { arg1: value1, arg2: value2 });
   ```

## Troubleshooting

### Migration Conflicts

If you encounter conflicts during migration:
1. Run `supabase db reset` to start fresh locally
2. Check for conflicting migration files
3. Use `supabase db remote commit` to sync with remote state

### Type Generation Issues

If type generation fails:
1. Ensure your database is running (`supabase start`)
2. Check that your database link is correct (`supabase link --project-ref <ref>`)
3. Verify PostgreSQL schema is valid

### Database Connection Issues

1. Ensure Supabase is running locally (`supabase status`)
2. Check database URL configuration
3. Verify network connectivity to remote Supabase instance

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
