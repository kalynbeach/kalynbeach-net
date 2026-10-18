# `kalynbeach-net` 2026

> **WORK IN PROGRESS**

## Overview

i basically want to redesign and rebuild this entire personal site.

currently, this site is super stale and it needs a lot of love. it has nearly zero information, content, or experiences of value; its design, UI, and UX is very far off from what i'm envisioning; and on the whole it just doesn't fully reflect who and where i am today as an engineer, as an artist, and as a human in general.

---

## Tech Stack

> This is the WIP target tech stack for the rebuild

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

Agents:

- Pi Durable

---

## Site Structure

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
			WavePlayer
			WaveGenerator
			WaveFrame
	light
		images
		videos
		shaders
```

---

## Design

### Design System(s)

- [kalynbeach/kkb/DESIGN.md](https://github.com/kalynbeach/kkb/blob/main/DESIGN.md)
- [kalynbeach/kkb/docs/design/kkb-design.md](https://github.com/kalynbeach/kkb/blob/main/docs/design/kkb-design.md)
- [kalynbeach/kevelle-gui](https://github.com/kalynbeach/kevelle-gui)
- [kalynbeach/kevelle-gui/DESIGN.md](https://github.com/kalynbeach/kevelle-gui/blob/main/DESIGN.md)

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

### Design Skills & Resources

i want to fully utilize my latest `kkb` agent design skills for this redesign.

- [jakubkrehel/skills](https://github.com/jakubkrehel/skills)
- [emilkowalski/skills](https://github.com/emilkowalski/skills)
