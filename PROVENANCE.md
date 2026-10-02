# Provenance

## Original project assets

SCRAPLINE's game code, UI, loaner scribble, track layout, checkpoint logic, arcade physics, hazard logic, procedural stadium meshes, canvas signage, paper grain, wheel artwork, and CSS were created for this project. The player's own strokes become SVG previews and the Three.js car texture without replacement by a stock car. Rival cars use variations of the original loaner artwork.

No downloaded models, stock photos, generated raster art, paid APIs, audio, or third-party game assets are used. Screenshots produced by browser QA depict the running local game. There is no process recording or video asset.

## Dependencies

Exact installed versions and integrity hashes are pinned in `package-lock.json`. Upstream license files remain in their installed packages.

| Package | Purpose | License |
| --- | --- | --- |
| React, React DOM | Workshop, HUD, touch controls, results | MIT |
| Three.js | WebGL renderer and geometry | MIT |
| Vite, `@vitejs/plugin-react` | Local server and production bundling | MIT |
| TypeScript | Static type checking | Apache-2.0 |
| Vitest | Simulation and persistence tests | MIT |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/three` | Development type definitions | MIT |
| `@fontsource/barlow-condensed` | Locally bundled Barlow Condensed display font | SIL Open Font License 1.1 |
| `@fontsource/dm-sans` | Locally bundled DM Sans body and numeral font | SIL Open Font License 1.1 |

Barlow was designed by Jeremy Tribby. DM Sans was commissioned by Google from Colophon Foundry. Fontsource packages self-host the font files; the game makes no Google Fonts network requests. All runtime assets are bundled locally.
