# AGENTS.md - Developer Guide

## Commands

- **Build:** `bun run build`
- **Lint:** `bun run lint`
- **Test:** `bun test` (watch) | `bun run test run` (once)
- **Test Single:** `bun test [filename]`
- **Format:** `bun run format`
- **DB Types:** `bun run db:types` (Sync Supabase types)

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, Tailwind CSS v4.
- **Runtime:** Bun (Strictly use `bun`/`bunx`).
- **State/DB:** Supabase (Auth + Postgres), Zod (Validation).
- **UI:** `shadcn/ui` (Radix), `lucide-react`, `react-three-fiber` (R3F).

## Key Architectures

- **Audio (3 Systems):**
  - **Refactored (Target):** `lib/sound.ts`, `components/sound/`.
  - **Wave-Player (Active):** `components/wave-player/` (Playlist/Tracks).
  - **Wave-Lab (Legacy):** `components/wave-lab/` (Do not modify unless requested).
- **3D:** Located in `components/r3f/`.

## Code Style & Rules

- **Style:** Prettier defaults (Double quotes, 2-space indent).
- **Type Safety:** Strict TypeScript (No `any`).
- **Imports:** Absolute imports (`@/`).
- **Conventions:** Follow `.cursor/rules/`. Use `zod` for schemas.
