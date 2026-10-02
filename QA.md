# SCRAPLINE QA record

Validated locally on 2026-10-02. No deployment, push, or commit performed.

## Verified desktop browser race

The real-time development harness dispatched pen PointerEvents and keyboard events into the actual game in a 1000 x 760 iframe. The player completed two laps in **60.63 seconds**. The harness did not move the player directly during the race; its steering decisions were converted to the same keyboard events used by gameplay. This is automated browser input, not a claim of a human playtest or native hardware input.

Observed PASS results:

- Empty drawing stays in workshop with guidance; three disconnected/open pen strokes are preserved; Undo removes only the last stroke.
- The fitted drawing appears in the lift transformation and the Three.js stadium initializes.
- Pause freezes simulation time and resume continues it.
- Space drift builds charge (maximum observed **0.76**); release and Shift boost occur in the live simulation.
- Corner traversal, ordered checkpoints, lap crossing, and two-lap finish validate.
- Results contain position, race time, best lap, and the actual drawing.
- All three rivals complete at least one validated lap before the player finishes.
- Retry resets time while keeping the drawing; redraw restores original strokes.
- Separate, explicitly repositioned probes verify ink grip loss, stamp impact, bounded barrier collision, and recovery without advancing progress. These probes are not represented as naturally encountered race events.
- Workshop and round-trip horizontal overflow: **0 pixels**. Captured browser error events and console errors: **0**.

## Mobile input and layout

At a 390 x 844 CSS viewport, the touch-control row fits without overlapping targets. Steering buttons measure 65 x 60, drift and boost 65 x 91, and brake 139 x 31. Controls use `touch-action: none`.

Held synthetic touch PointerEvents verified live heading changes, simultaneous steering/drift charge, release boost, boost-reserve consumption, cancel releasing boost, and braking reducing speed. Race horizontal overflow: **0 pixels**. This is responsive browser coverage, not physical iPhone/Android or native multi-touch-device certification.

## Fixes and regression coverage

1. **Saved-off preferences:** replaced truthy fallback with nullish fallback, preserving explicit `false` for auto-acceleration and reduced motion while retaining device defaults for unset settings.
2. **Touch release handling:** release on pointer-up, cancel, and lost capture; releasing one steering button no longer clears an opposite steering input. Native pointer capture remains enabled for real device events.

Additional hardening filters malformed persisted points, saves in-progress drawings, isolates development QA records from normal player records, and bundles fonts locally instead of requiring Google Fonts at runtime.

## Automated validation

`npm test`: **24 tests pass** across simulation/drawing and storage suites. Coverage includes drawing normalization, disconnected strokes, tiny/extreme shapes, ordered laps, reverse/finish-line rocking rejection, checkpoint jump rejection, ranking, pause, fixed collision bounds, both hazards affecting rivals and player, earned drift boost, recovery, a full AI-controlled race, deterministic replay, bounded catch-up, rendering cadence independence, and storage denial/corruption/preferences.

A deterministic AI barrier test confirms collision, bounded course position, progress increments under 0.4 units per tick, and recovery to speed above 5 without teleporting. Its first fixture failed to collide because AI avoided the wall; moving its starting position next to the barrier made the intended collision test valid. No speculative physics change was made.

`npm run build`: TypeScript and Vite production build pass. Vite reports a non-fatal large-chunk advisory for the Three.js/React bundle; this remains a small single-track game rather than a code-split application.

## Evidence

- `evidence/desktop-race-15s.png`: actual WebGL frame captured during the verified browser race. Original download: `/Users/matt/Downloads/desktop-race-15s.png`.
- Browser-tool screenshots also showed the actual stadium, recognizable paper vehicle, oblique camera through a corner, and 390px layout. They are screenshots, not process video.
- Downloadable live WebGL frames remain supported in the development-only `?qa` harness.

## Remaining limitations

- No supported process recording or video export was available; no gameplay clip is claimed.
- No physical touch-device, Safari/Firefox, low-end GPU, or native sustained-key-hold certification. The completed race uses synthetic DOM keyboard input.
- WebGL context-loss fallback and teardown are implemented but context loss was not deliberately injected in browser QA.
- The car is a pair of thin, double-sided ink cutouts on a fixed chassis, not a volumetric reconstruction. Unusual drawings remain recognizable but do not alter handling.
- Sound is intentionally absent. The game works silently; no mute control is needed.
- The full browser race was completed before the final font self-hosting change; the final production build validates that asset change. Final font rendering was not separately re-screenshotted.
