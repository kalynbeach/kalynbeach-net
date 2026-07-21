# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next.js 16 personal website featuring three parallel audio systems, 3D graphics, and music-related functionality:

- **UI**: React 19.2, shadcn/ui + Tailwind CSS v4 + Zod validation
- **3D Graphics**: Three.js, @react-three/fiber, @react-three/drei
- **Audio Systems**: Three coexisting architectures (refactored sound, legacy wave-lab, wave-player)
- **Auth**: Clerk identity with Convex application roles (`guest | vip | admin`)
- **Database**: Convex (playlists, tracks, users, playlist relations)

## Development Commands

### Core Commands (Uses Bun)

- `bun dev` - Start development server (uses Turbopack)
- `bun run build` - Production build
- `bun run build:turbo` - Production build with Turbopack
- `bun start` - Start production server
- `bun run lint` - Run ESLint
- `bun test` - Run Vitest tests
- `bun run format` - Format code with Prettier
- `bun run format:check` - Check code formatting

### Convex Commands

- `bunx convex dev` - Sync functions and watch the development deployment
- `bunx convex dev --once --typecheck enable --tail-logs disable` - Validate and sync once

## Architecture

### Directory Structure

- `app/` - Next.js App Router pages and API routes
  - `(admin)/` - Protected admin routes (dashboard, lab)
  - `sound/` - Audio-related pages with three different systems
  - `api/` - Server API endpoints for audio and playlists
- `components/` - React components organized by domain
  - `ui/` - shadcn/ui base components
  - `site/` - Site-wide components (header, nav, theme)
  - `sound/` - **Refactored sound system (NEW)**
  - `wave-lab/` - **Legacy sound system (DEPRECATED but active)**
  - `wave-player/` - **Specialized audio player system**
  - `r3f/` - React Three Fiber 3D components
- `contexts/` - React Context providers for different audio systems
- `hooks/` - Custom React hooks organized by audio system
- `convex/` - Schema, queries, mutations, authorization, and deterministic preview seed
- `lib/` - Utilities and type definitions
  - `convex/` - Server-side Convex auth and data adapters
- `docs/sound/` - Audio architecture documentation

### Current Audio Architecture (Three Parallel Systems)

**IMPORTANT**: This codebase currently has three coexisting audio systems due to ongoing refactoring:

1. **Refactored Sound System** (Current/Active)
   - `lib/sound.ts` - Core sound functions
   - `hooks/use-sound.ts` - AudioContext, MediaDevice, MediaStream management
   - `hooks/use-sound-visualizer.ts` - Visualization logic
   - `components/sound.tsx`, `components/sound-card.tsx` - Main components
   - Used in `/sound/sound-card` route
   - This is the target architecture

2. **Wave-Lab System** (Legacy/Deprecated but Active)
   - `components/wave-lab/` - Legacy visualization components
   - `contexts/sound-context.tsx` - Legacy AudioContext management
   - `hooks/wave-lab/` - Specialized legacy hooks (Meyda integration, device management)
   - Used in `/sound/wave-lab` route
   - **NOTE**: Marked for removal but still actively used

3. **Wave-Player System** (Specialized/Active)
   - `components/wave-player/` - Full-featured audio player
   - `contexts/wave-player-context.tsx` - Complex player state management
   - `hooks/wave-player/` - Player-specific hooks
   - Used in `/sound/wave-player` route
   - Database-integrated audio player for playlists/tracks

### Key Technical Details

**Audio Context Management**:

- Each system manages its own AudioContext independently
- Legacy `sound-context.tsx` still used by wave-lab
- Wave-player has its own context system
- Refactored sound system uses simplified approach

**Data Layer** (`convex/`, `lib/convex/`):

- Convex owns tracks, playlists, playlist relations, users, and application roles
- Public queries expose player-safe projections; sensitive functions enforce roles internally
- Clerk establishes identity and supplies the session token used by server-side Convex calls
- Wave Player reads Convex at request time through the server adapter

**3D Graphics**:

- React Three Fiber with custom scene components
- SVG export functionality for 3D meshes
- Performance monitoring with r3f-perf

**Authentication**:

- Clerk middleware establishes identity
- Dashboard and lab require the Convex `admin` role
- Sensitive Convex functions perform their own authorization checks

## Current Sound Refactoring Status

Based on `docs/sound/refactor-sound.md`:

- ✅ New refactored sound system implemented
- ❌ Legacy wave-lab code NOT yet removed (still active)
- ❌ Documentation needs updating
- The refactor is **partially complete**

**When working with sound code:**

- New features should use the refactored `components/sound/` system
- Legacy `components/wave-lab/` code exists but is deprecated
- `wave-player` system is separate and fully supported
- Check `docs/sound/` for detailed architecture diagrams

## Testing

- Uses Vitest with jsdom environment
- Tests located in `tests/` directory
- Run tests once: `bun run test run`
- Run tests in watch mode: `bun run test`
- Run single test: `bun test [test-file-name]`

## Adding Components

- Add shadcn/ui components: `bunx --bun shadcn@canary add [components]`

## Important Notes

- **Package Manager**: Uses Bun (see `bun.lock`)
- React Compiler enabled for optimization
- View Transitions API enabled experimentally
- Custom font: Berkeley Mono (TX-02-VF.woff2)
- Audio features require user interaction due to browser autoplay policies
- Multiple AudioContext instances exist due to parallel audio systems
