# Database Capability

Data persistence and querying for tracks, playlists, and file storage.

## ADDED Requirements

### Requirement: Convex Backend

The system SHALL use Convex as the backend for database operations with reactive queries and mutations.

#### Scenario: Reactive query updates
- **WHEN** data changes in Convex database
- **THEN** all subscribed `useQuery` hooks automatically update
- **AND** UI reflects changes without manual refetch

#### Scenario: Mutation execution
- **WHEN** client calls `useMutation` hook
- **THEN** Convex executes mutation function
- **AND** returns result to client

### Requirement: Track Storage

The system SHALL store tracks in Convex `tracks` table with schema validation.

#### Scenario: List tracks
- **WHEN** client calls `api.tracks.list` query
- **THEN** returns array of track documents
- **AND** each track includes title, artist, isLoop, and optional fields

#### Scenario: Create track
- **WHEN** client calls `api.tracks.create` mutation with valid data
- **THEN** new track document is inserted
- **AND** returns new document ID

#### Scenario: Update track
- **WHEN** client calls `api.tracks.update` mutation with ID and changes
- **THEN** track document is patched
- **AND** only specified fields are modified

#### Scenario: Delete track
- **WHEN** client calls `api.tracks.remove` mutation with ID
- **THEN** track document is deleted

### Requirement: Playlist Storage

The system SHALL store playlists with track associations using junction table pattern.

#### Scenario: List playlists
- **WHEN** client calls `api.playlists.list` query
- **THEN** returns array of playlist documents

#### Scenario: Get playlist with tracks
- **WHEN** client calls `api.playlists.getWithTracks` query with playlist ID
- **THEN** returns playlist document with resolved tracks array
- **AND** tracks are ordered by position

#### Scenario: Add track to playlist
- **WHEN** client calls `api.playlists.addTrack` mutation
- **THEN** creates `playlistTracks` junction record
- **AND** auto-assigns position if not specified

#### Scenario: Remove track from playlist
- **WHEN** client calls `api.playlists.removeTrack` mutation
- **THEN** deletes corresponding `playlistTracks` record

### Requirement: Convex File Storage

The system SHALL use Convex storage for audio files.

#### Scenario: Generate upload URL
- **WHEN** client calls `api.storage.generateUploadUrl` mutation
- **THEN** returns presigned URL for file upload

#### Scenario: Get file URL
- **WHEN** client calls `api.storage.getUrl` query with storage ID
- **THEN** returns public URL for file access

#### Scenario: Track references storage file
- **WHEN** track has `fileId` field set
- **THEN** audio player can resolve file URL via `api.storage.getUrl`

### Requirement: Legacy S3 Support

The system SHALL continue supporting legacy S3 URLs during migration period.

#### Scenario: Track with S3 URL
- **WHEN** track has `src` field but no `fileId`
- **THEN** audio player uses `src` URL directly

#### Scenario: Track with both storage types
- **WHEN** track has both `fileId` and `src` fields
- **THEN** prefer `fileId` (Convex storage) over `src` (S3)

## REMOVED Requirements

### Requirement: Supabase Postgres Database

**Reason**: Replaced by Convex document database
**Migration**: Export data via scripts, import to Convex using `bunx convex import`

### Requirement: Supabase S3 Storage

**Reason**: Replaced by Convex file storage
**Migration**: Gradual file migration using `migrateS3ToConvex` action

### Requirement: Service Layer Pattern

**Reason**: Convex functions replace `BaseService` class pattern
**Migration**: Delete `db/services/` directory, use Convex hooks directly
