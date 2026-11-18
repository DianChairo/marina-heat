# BUILD_NOTES — Marina Heat (gta6-01), round 3 rewrite

Round 3: the entire entry was rewritten fresh in one recorded session — every line of game
code, `main.ts`, the README and the screenshot driver was authored in-session with file
tools after deleting the round-2 build. `vendor/makefun-game.ts`, `LICENSE`,
`.makefun/owner.json`, `serve.ts` and `shots.json` are untouched kit plumbing.

## The game

**Marina Heat** — an original top-down 2D open-world crime game in the fictional city of
Coral Marina. Vanilla JavaScript + Canvas 2D, ES modules, no libraries, no network
requests, everything under `game/`. Total game source text: 72,189 bytes (~72 KB).

Systems, all wired together in one state machine:

- **City**: seeded 3200×3200 grid — roads with dashed lane markings, crosswalks,
  sidewalks, varied flat-shaded buildings with lit windows and shop awnings, palm/lamp/
  hydrant props, a southern beach and animated water edge. Smooth follow camera + shake.
- **On foot**: WASD/arrows, mouse aim, click hitscan shooting (tracer + muzzle flash),
  Shift sprint, health with slow regen, WASTED screen with run stats + restart.
- **Cars**: parked cars city-wide; E steals (driver-side yank; occupied traffic drivers
  flee), E exits. Arcade driving with drift (Space), building blocks, car/ped crashes
  with damage and camera shake, engine pitch follows speed.
- **Traffic AI**: lane-following cars that turn at intersections, brake for obstacles,
  honk when stuck, recycle near the player; they can be stolen mid-route.
- **Pedestrians**: sidewalk wanderers who pause, panic and flee gunfire, fast cars and
  crashes; getting hit is a witnessed crime.
- **Wanted system**: witnessed crimes fill a HEAT meter toward 1–5 stars; police spawn at
  the edges and chase/ram on road and on foot; stars decay out of sight; sustained police
  contact at low speed fills BUSTED → busted screen with stats + restart.
- **Combat/damage**: shots damage cars (smoke < 55 hp, fire < 25 hp, wreck at 0 with
  sparks) and pedestrians; wrecks feed chaos score.
- **Missions** (M marker downtown, HUD objective + off-screen arrow + minimap marker):
  1. *Bay Run* — 7-checkpoint race vs a 95 s timer.
  2. *Special Delivery* — pier pickup, cross-town drop, wanted heat while carrying.
  3. *Rampage* — 600 chaos points (wrecks, crashes, near misses) in 80 s.
  Fixer **Marisol Vega** strings them together with phone-style messages (intro, briefings,
  outros). Cash + respect persist to localStorage; start screen offers Continue.
- **HUD**: canvas minimap (roads, blocks, water, buildings, traffic dots, flashing police
  blips, mission marker, player arrow, north up), wanted stars, HEAT and BUSTED bars,
  health, cash/respect, speedometer while driving, objective banner, phone box, hints.
- **Audio**: fully synthesized WebAudio — engine hum, two-tone siren (police only),
  gunshot, crash thud, honk, cash blip, mission sting, phone blip, ambient pad. Starts on
  first gesture; M mutes. Pause with P/Esc.

## Modules (game/src/)

| File | Job |
| --- | --- |
| `main.js` | boot, shared state, crime/chaos wiring, game loop, state machine |
| `city.js` | Coral Marina map data, building collision, world rendering |
| `rng.js` | seeded RNG (mulberry32) + math helpers |
| `input.js` | keyboard/mouse state with edge-triggered presses |
| `player.js` | on-foot movement/aim, car entry/exit, drawing, regen |
| `vehicles.js` | car factory, drift physics, damage states, car–car collisions, drawing |
| `traffic.js` | parked placement + lane-following traffic AI |
| `pedestrians.js` | wander/flee/panic AI, run-over handling, drawing |
| `police.js` | wanted stars, heat, busted meter, police spawn + chase/ram AI |
| `combat.js` | hitscan shooting, tracers, particles, muzzle flash |
| `missions.js` | Marisol's job rotation, timers, chaos scoring, near-miss detection |
| `hud.js` | bars, stars, banners, phone box, pause/end overlays, world markers |
| `minimap.js` | corner minimap rendering |
| `audio.js` | synthesized WebAudio sound system |
| `storage.js` | localStorage save/load |
| `shots.js` | deterministic `?shot=<name>&seed=<n>` screenshot scenes |

Plus `game/index.html` (start screen: title, story blurb, controls, Start/Continue) and
`game/style.css`. Root `main.ts` copies `game/` + `screenshots/` to the output dir, logs
the copied file count and game title, and writes `dossier.json` via `buildDossier`.

## Screenshot scenes (deterministic, seed 7, 1280×720, JPEG q80)

Driver written fresh this session: `~/workspace/tools/game-shots/take-shots-gta6-r3.mjs`
(own tiny static server + headless Chrome; waits for `window.__shotReady`).

| File | Scene | Size |
| --- | --- | --- |
| `screenshots/1-cover.jpg` | on foot downtown at golden hour, traffic + peds, M marker, phone intro, minimap | 102,401 B |
| `screenshots/2-drive.jpg` | driving fast (261 km/h) through an intersection, traffic around, speed on HUD | 116,281 B |
| `screenshots/3-chase.jpg` | 3 police cars pursuing, 4 wanted stars, HEAT + BUSTED bars, police blips on minimap | 118,412 B |
| `screenshots/4-mission.jpg` | Special Delivery in progress: package carried, objective + distance, destination arrow, 2 stars | 120,016 B |

All four visually verified by reading the images back (world, HUD and minimap render).
Real-input smoke test in the same driver: load → click Start → WASD keys → mouse shot
(2 shots registered) → P pause (`mode=pause`) → P resume (`mode=play`) — **zero page
errors**.

## Verification

- `node --check` passes on every `game/src/*.js`.
- `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — out/ held `game/`,
  `screenshots/` (4 JPEGs) and `dossier.json`; 22 files copied; out/ removed afterwards
  (build artifact, not committed).
- Kit check: `node cli/makefun.mjs check --kit . --repo <repo>` from the gta6-01 kit —
  **exit 0: 4 passed, 0 failed, 16 skipped (site-side transcript checks), 5 at submission**.
