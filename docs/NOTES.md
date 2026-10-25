# `kalynbeach-net` 2026

> **WORK IN PROGRESS**

## Overview

i basically want to redesign and rebuild this entire personal site.

currently, this site is super stale and it needs a lot of love. it has nearly zero information, content, or experiences of value; its design, UI, and UX is very far off from what i'm envisioning; and on the whole it just doesn't fully reflect who and where i am today as an engineer, as an artist, and as a human in general.

this repo's current `README.md` is an absolute mess. it will need not only a complete rewrite, but also a totally different purpose and style of writing going forward. what i mainly mean here is this: i want `README.md` to be written for **human** readers, both in terms of the information it contains about the project and the style of its writing.

the `docs/` directory's markdown documents (besides this `NOTES.md` doc) are pretty much completely out of date. just about all of them will need to be archived, which i'll probably just keep locally.

---

## Tech Stack

> This is the **WORK IN PROGRESS** target tech stack for the rebuild

Core:

- TypeScript 7
- Bun
- Effect 4
- Next.js 16.4

Frontend:

- React 19.3
- Tailwind CSS
- shadcn/ui
- Base UI
- Phosphor Icons
- React Three Fiber v10
- vercel-labs/json-render
- vercel-labs/vgpu

Tooling:

- Oxc (oxfmt, oxlint)
- shadcn/lint
- dmmulroy/anti-slop

Backend:

- Convex (database)
- Clerk (auth)

Infrastructure:

- Vercel (deployment, analytics, etc.)
- Cloudflare?
- celld?

AI:

- Claude Code (via T3 Code)
- Pi & Pi Durable
- Codex

---

## Site Structure

> **WORK IN PROGRESS**

```
home
about
	who am i
	work
	connect with me
software
	engineering
		context
		projects
		agents
	design
		abstractions
		design systems
		UI & UX
	lab
		explorations
		experiments
		studies
waves
	sound
		audio
		music
		components
			WavePlayer (WIP)
			Oscilloscope (Kevelle, WIP)
			Binaural (Kevelle, WIP)
	light
		images
		videos
		shaders
```

---

## Design

### Design System

this site now uses my new `kevelle` design system from my `kkb` monorepo's `@kkb/registry` shadcn/ui registry; the redesign will build on it.

- [@kkb/registry](https://github.com/kalynbeach/kkb/blob/main/apps/registry/README.md)
- [@kkb/registry/kevelle](https://github.com/kalynbeach/kkb/tree/main/apps/registry/registry/kevelle)
- [Kevelle design system](https://github.com/kalynbeach/kkb/blob/main/apps/registry/registry/kevelle/DESIGN.md)
- [kalynbeach/kkb/DESIGN.md](https://github.com/kalynbeach/kkb/blob/main/DESIGN.md)
- [kalynbeach/kkb/docs/design/kkb-design.md](https://github.com/kalynbeach/kkb/blob/main/docs/design/kkb-design.md)

### Design Inspiration

#### Interfere

- [Interfere Design System](https://design.interfere.com/)
- [Interface Cheat Sheet](https://interfaces.dev/cheat-sheet)

[Steel Palette](https://oklch.fyi/color-palettes/steel):

```css
:root {
  --color-1: oklch(0.2 0.003 240);
  --color-2: oklch(0.3 0.004 240);
  --color-3: oklch(0.4 0.005 240);
  --color-4: oklch(0.54 0.006 240);
  --color-5: oklch(0.75 0.005 240);
  --color-6: oklch(0.85 0.004 240);
  --color-7: oklch(0.9 0.003 240);
  --color-8: oklch(0.94 0.002 240);
  --color-9: oklch(0.98 0.001 240);
}
```

#### Stencil

i really love Stencil's design system and overall aesthetic; the colors, typography, and style details, especially on the home page and in their blog posts' interactive diagrams and visuals.

- [Stencil: New instruments for building software](https://stencil.so/)
- [You only need the frontier model for one single edit · Stencil](https://stencil.so/blog/prewalk)
- [Snapcompact: SoTA compaction — instant, local, free. Pick 3 · Stencil](https://stencil.so/blog/snapcompact#the-case-against-compaction)

### Design Skills & Resources

i want to fully utilize my latest `kkb` agent design skills for this redesign.

- [jakubkrehel/skills](https://github.com/jakubkrehel/skills)
- [emilkowalski/skills](https://github.com/emilkowalski/skills)
