# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`drill-game` ("⛏ Foreuse Profonde") is a *Motherload*-style browser mining game: drill
deeper into a procedurally generated planet, collect ores, sell/refuel/upgrade at three
surface buildings, and recall the rocket once you clear a $10M debt. UI text and most code
comments are in **French**.

## Commands

Package manager is **Bun** (`bun.lock`). The dev server runs on **port 5174** (5173 is
usually occupied on this machine).

```bash
bun install
bun run dev       # vite dev server (http://localhost:5174)
bun run build     # tsc -b && vite build → dist/
bun run preview   # serve the production build
bun run lint      # eslint .
```

### Smoke test

`scripts/smoke.ts` plays the full loop in headless Chromium (drill, jetpack, sell, refuel,
upgrade, teleport, save persistence) by driving keyboard input and asserting against the
dev-only `window.__engine` / `window.__store` globals.

```bash
bun run dev &            # must be running first
bun scripts/smoke.ts     # uses GAME_URL (default http://localhost:5174)
```

It needs a Chromium binary: it defaults to the playwright-core Chromium in the
`ms-playwright` cache, overridable via `CHROMIUM_PATH`. There is no unit-test runner — the
smoke test is the test suite.

## Architecture

Two cooperating worlds that share state through a single Zustand store:

1. **The game** — a Canvas 2D simulation in `src/game/`, owned by the `Engine` class.
2. **The UI** — React 19 components in `src/ui/` (HUD, shop, inventory, modals), mounted as
   overlays in `src/App.tsx` on top of the single `<canvas>`.

### Engine loop (`src/game/engine.ts`)

`Engine` runs a **fixed-timestep** loop (`STEP = 1/60`) via `requestAnimationFrame`: it
accumulates real elapsed time and steps `update(dt)` in 1/60s increments, then `render()`s
once per frame. `GameCanvas.tsx` constructs one `Engine`, calls `start()`/`stop()` on
mount/unmount, and (in DEV) exposes it as `window.__engine`. The engine holds all transient
simulation state (player physics, digging, particles, dynamites, rocket, camera, game clock).

### Store ↔ engine bridge (`src/store.ts`)

The Zustand store (`useGameStore`, DEV global `window.__store`) holds **persistent/economic
state**: money, fuel, hull, cargo, upgrade tiers, depth, UI mode. The two layers communicate
in one direction each:

- **Engine reads the store** every `update()` via `useGameStore.getState()` (e.g. to pause
  when `ui !== 'playing'`).
- **UI commands the engine** through a `pendingAction` field (`'teleport' | 'newgame' |
  'dynamite' | 'recall'`). Store actions set it; the engine consumes it at the top of
  `update()` and calls `clearPending()`. This is how React buttons trigger world events
  without holding an engine reference. When adding a new UI-driven world event, follow this
  pattern rather than reaching into the engine directly.

`ui: UiMode` drives which React overlay is visible and pauses the sim. `BuildingId` values
(`sell`/`fuel`/`garage`) double as UI modes.

### World generation (`src/game/world.ts`, `src/game/rng.ts`)

`World` generates terrain **lazily, one row at a time**, seeded so a given `(seed, y)` always
produces the same row (`mulberry32` seeded with `seed ^ hash(y)`). Dug tiles are tracked in a
`Set<number>` keyed `y * WORLD_W + x`; only the seed + dug set are saved, so the world is
fully reconstructable. Ore distribution, cave/boulder/lava frequencies, and rock hardness all
scale with depth.

### Rendering (`src/game/render.ts`, `src/game/tileart.ts`)

100% procedural pixel-art — no image assets. `tileart.ts` pre-bakes tile sprites into an
offscreen atlas at startup (`initTileAtlas`); `render.ts` draws the world, player, effects,
day/night cycle, and buildings each frame.

### Balance & content (`src/game/constants.ts`)

Single source of truth for all tuning: tile definitions (`TILES`), ore bands/values, upgrade
tiers (`DRILL_TIERS`, `TANK_TIERS`, `HULL_TIERS`, `JETPACK_TIERS`, `CARGO_TIERS`,
`RADIATOR_TIERS`), prices, physics constants, and dig/burn formulas. Gameplay-balance changes
generally belong here, not in the engine.

### Persistence (`src/game/save.ts`)

Saves to `localStorage` key `drill-game-save-v1`. The store and engine each load on init and
defensively migrate older saves (e.g. defaulting newly added upgrade tiers, dropping removed
ores). Autosaves every 5s and on `beforeunload`.

## Conventions

- TypeScript is strict-ish: `noUnusedLocals`/`noUnusedParameters` are on and `verbatimModuleSyntax`
  is enabled, so use `import type` for type-only imports. `bun run build` runs `tsc -b` and
  will fail the build on type errors.
- `import.meta.env.DEV` guards the `window.__engine`/`window.__store` debug globals — keep new
  debug hooks behind it.
