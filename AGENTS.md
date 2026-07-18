# AGENTS.md - Developer Guide

## Commands

- **Build:** `bun run build`
- **Lint:** `bun run lint`
- **Test:** `bun test` (watch) | `bun run test run` (once)
- **Test Single:** `bun test [filename]`
- **Format:** `bun run format`
- **Convex Dev:** `bunx convex dev`
- **Convex Check:** `bunx convex dev --once --typecheck enable --tail-logs disable`

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19.2, Tailwind CSS v4.
- **Runtime:** Bun (Strictly use `bun`/`bunx`).
- **Identity:** Clerk.
- **Data/Roles:** Convex (`guest | vip | admin`), Zod (Validation).
- **UI:** `shadcn/ui` (Radix), `lucide-react`, `react-three-fiber` (R3F).

## Key Architectures

- **Audio (3 Systems):**
  - **Refactored (Target):** `lib/sound.ts`, `components/sound/`.
  - **Wave-Player (Active):** `components/wave-player/` (Playlist/Tracks).
  - **Wave-Lab (Legacy):** `components/wave-lab/` (Do not modify unless requested).
- **3D:** Located in `components/r3f/`.
- **Auth:** Clerk establishes identity; sensitive Convex functions enforce app roles.
- **Data:** Convex schema/functions live in `convex/`; server adapters live in `lib/convex/`.

## Code Style & Rules

- **Style:** Prettier defaults (Double quotes, 2-space indent).
- **Type Safety:** Strict TypeScript (No `any`).
- **Imports:** Use absolute imports (`@/`) in app code. Relative imports under `convex/` follow Convex runtime conventions.
- **Conventions:** Follow `.cursor/rules/`. Use `zod` for schemas.
