# Project Context

## Purpose
Personal website featuring three parallel audio systems, 3D graphics, and music-related functionality. Serves as portfolio, audio experimentation platform, and music content hub.

## Tech Stack
- **Language**: TypeScript (strict, no `any`)
- **Runtime**: Bun (NOT Node.js)
- **Package Manager**: Bun (NOT `npm`, `pnpm, `yarn)
- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: React 19.2, React Compiler
- **Components**: shadcn/ui
- **Styles**: Tailwind CSS v4 (OKLCH colors)
- **Graphics**: Three.js, @react-three/fiber, @react-three/drei
- **Validation**: Zod
- **Database**: Supabase Postgres
- **Auth**: Supabase Auth
- **Testing**: Vitest

## Project Conventions

### Code Style
- TypeScript strict mode, never use `any` type
- Prettier for formatting (`bun run format`)
- ESLint for linting (`bun run lint`)
- Lowercase conventional commit descriptions

### Architecture Patterns
- **App Router**: File-based routing with route groups
- **Service Layer**: `BaseService` class pattern in `db/services/`
- **Context Providers**: Per-system state management (sound, wave-player)
- **Server Caching**: React `cache()` for DB queries
- **Component Organization**: Domain-based (`sound/`, `wave-lab/`, `r3f/`)

### Testing Strategy
- Vitest with jsdom environment
- Tests in `tests/` directory
- Run: `bun test` (watch) or `bun test run` (once)

### Git Workflow
- Main branch: `main`
- Conventional commits: `<type>: <description>`
- Types: `feat`, `fix`, `docs`, `refactor`, `deps`, `chore`

## Domain Context
**Three Parallel Audio Systems** (critical to understand):
1. **Refactored Sound** (`components/sound/`, `hooks/use-sound.ts`) - Target architecture
2. **WaveLab** (`components/wave-lab/`, `contexts/sound-context.tsx`) - Legacy, deprecated but active
3. **WavePlayer** (`components/wave-player/`, `contexts/wave-player-context.tsx`) - Specialized playlist player

Each system manages its own AudioContext. New features should use refactored sound system.

## Important Constraints
- Browser autoplay policies require user interaction for audio
- Package manager must be Bun, not npm/yarn/pnpm
- React Compiler enabled for optimization
- Multiple AudioContext instances exist due to parallel systems

## External Dependencies
- **Supabase**: Auth, Postgres database (playlists, tracks, users)
- **Vercel**: Deployment platform
- **Custom Font**: Berkeley Mono (TX-02-VF.woff2)
