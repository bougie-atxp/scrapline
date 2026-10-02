# SCRAPLINE

**Draw badly. Drive beautifully.** Sketch a side-view car, lift your actual ink into a paper racer, and race two laps of a cardboard desktop stadium against three rivals.

## Hosted demo

**https://bougie-atxp.github.io/scrapline/** — built automatically from `main` by `.github/workflows/deploy.yml`.

## Run locally

## Hosted demo

The latest `main` deployment publishes automatically to GitHub Pages via `.github/workflows/deploy.yml`. Enable **Settings → Pages → Build and deployment → Source: GitHub Actions** if the workflow has not run yet.

Requires Node.js 22.12+ (or Node 20.19+) and npm. No backend, account, API keys, or external asset service.

```sh
cd /Users/matt/Unbiased/scrapline
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. The server stays local; nothing is deployed.

```sh
npm test
npm run build
npm run preview
```

The production preview is **http://127.0.0.1:4173/**. Build output is `dist/`. `npm test` runs all deterministic Vitest tests once.

## Play

- Draw with mouse, pen, or touch. Nose points right. Undo, Clear, three inks, and a loaner are available. All valid drawings share the same handling and collision dimensions; disconnected marks remain visible.
- **W / Up:** accelerate. **S / Down:** brake. **A/D / Left/Right:** steer.
- **Space:** hold while steering at speed to charge a drift. Release after the charge mark for an earned burst; a full charge earns a longer burst.
- **Shift:** spend regenerating boost reserve. **R:** recover facing forward without moving ahead.
- **P / Escape:** pause. Pause also offers auto-acceleration, reduced decorative motion, restart, and redraw. Losing window focus or hiding the tab pauses the race.
- Touch devices get large left/right, brake, drift, and boost buttons. Auto-acceleration defaults on for small or coarse-pointer screens. Steering and drift can be held together.

The stamp winds up and flashes its landing shadow before impact; use the other side of the track. Outlined ink reduces grip briefly and leaves tire marks. Both hazards affect rivals. Drift around the stamp corner, release, then run beneath the folded programme bridge.

Finish two ordered laps to see position, time, best lap, personal best, and your drawing. Retry keeps the car; redraw restores the original strokes. Drawings, settings, and best time are saved locally when storage is available. The game is intentionally silent.

## Code map

- `src/ui/DrawingPad.tsx`: pointer drawing, workshop, actual-stroke preview.
- `src/game/drawing.ts`: fitting and canvas textures; no closed-shape requirement.
- `src/game/simulation.ts`: 60 Hz arcade dynamics, drift, collisions, recovery, ranking.
- `src/game/track.ts`, `ai.ts`, `hazards.ts`: course projection, ordered checkpoints, rivals, obstacle rules.
- `src/game/replay.ts`: bounded fixed-step clock and deterministic input replay utility (not a player-facing replay editor).
- `src/render/scene.ts`: procedural Three.js stadium, paper cars, follow camera, disposal.
- `src/ui/RaceView.tsx`: input binding and throttled HUD; simulation does not run in React state.
- `src/game/storage.ts`: defensive local persistence.

## Browser validation harness

With the dev server running, open **http://127.0.0.1:5173/?qa**. Run the desktop drawing/race round trip or the 390px touch-control check. Keep the tab visible while tests run. The full race takes roughly 70 seconds in real time. The harness dispatches DOM pointer/keyboard events into the real game, observes live simulation, and reports PASS/FAIL. It explicitly repositions cars only for labelled hazard/collision probes. Normal play has no hidden player steering. Harness drawings and records use a separate development-only storage key.

The harness offers downloadable PNGs from actual WebGL frames. These are screenshots, not process video. See `QA.md` for the actual checks and limitations, and `PROVENANCE.md` for asset and dependency origins.
