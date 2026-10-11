# Legacy WavePlayer development archive

Archived on 2026-10-04 for [issue #26](https://github.com/kalynbeach/kalynbeach-net/issues/26).

- Tag: `archive/legacy-wave-player-2026-10-04`
- Commit: `112cf485563f439a235f3d0aba6a73ee6adae4fc`
- The remote tag was verified before removing the implementation. The tag preserves this repository's existing visibility.

The website no longer serves the legacy demo or its unused `/api/playlists/[id]` endpoint. The exact `/sound/wave-player` path temporarily redirects to `/tech/audio` with HTTP 307. This keeps the destination changeable during the planned site refresh. The case study describes the separate kkb-audio player, not this archived implementation.

## Inspect the source

These commands create a separate checkout without copying credentials or starting the app:

```sh
git clone --branch archive/legacy-wave-player-2026-10-04 --single-branch \
  git@github.com:kalynbeach/kalynbeach-net.git legacy-wave-player-reference
cd legacy-wave-player-reference
git rev-parse HEAD
git show HEAD:contexts/wave-player-context.tsx
```

The revision above contains the complete source, dependency lockfile and historical tests. Read these paths in that checkout:

- `app/sound/wave-player/`: page, initial playlist fetch and loading state.
- `components/wave-player/`: player, controls, visualization and failure states.
- `contexts/wave-player-context.tsx`: playback state and audio resource ownership.
- `hooks/wave-player/use-wave-player.ts`, `lib/wave-player/buffer-pool.ts` and `lib/types/wave-player.d.ts`: loading, buffer handling and contracts.
- `app/api/playlists/[id]/route.ts`, `lib/convex/server.ts` and `lib/convex/wave-player.ts`: website playlist integration.
- `tests/wave-player.test.tsx` and `tests/convex/wave-player.test.ts`: historical unit coverage.

## Historical runtime requirements

The archived revision uses Bun, Next.js 16.3.8, React 19.3, Web Audio, Clerk and Convex. `bun install --frozen-lockfile` installs its pinned dependencies. `bun run test run` uses mocked audio and local Convex-domain fixtures; it does not require a live deployment.

Running the old app required a Clerk publishable key, Clerk server configuration, `NEXT_PUBLIC_CONVEX_URL`, populated playlist/track records and reachable audio URLs with suitable CORS responses. The app root initializes the hosted clients, and opening the player fetches a playlist. Do not copy current environment files or start that runtime merely to inspect the source. A future runtime investigation should use separate test services and synthetic audio.

No Convex schema, functions, records or stored audio were deleted or migrated by the website retirement. SoundCard and WaveLab remain separate website code. The historical documentation in this directory describes the archived player and does not establish current product support.
