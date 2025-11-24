<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# AGENTS.md - Developer Guide

## Commands

- **Build:** `bun run build`
- **Lint:** `bun run lint`
- **Test:** `bun test` (watch) | `bun run test run` (once)
- **Test Single:** `bun test [filename]`
- **Format:** `bun run format`
- **DB Types:** `bun run db:types` (Sync Supabase types)

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19.2, Tailwind CSS v4.
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
