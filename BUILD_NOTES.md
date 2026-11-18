# Marina Heat — Build Notes (Round 6)

## Why round 6

Round 5 passed every transcript check and failed only `run_completes`:
its `main.ts` computed the output directory with `join()`, so when the
grader passed an ABSOLUTE `MAKEFUN_OUTPUT_DIR` (e.g. `/output`) on a
read-only copy of the repo, the path resolved underneath the repo and
`mkdir` died with EACCES. It also removed the output directory itself
with `rmSync`, which the grader may have created and mounted.

Round-6 fix in `main.ts`:

- `outDir = process.env.MAKEFUN_OUTPUT_DIR ? resolve(here, process.env.MAKEFUN_OUTPUT_DIR) : join(here, 'out')`
  — `resolve()` from `node:path` honours an absolute output dir as-is.
- After `mkdirSync(outDir, { recursive: true })`, only the CONTENTS are
  cleared: `for (const entry of readdirSync(outDir)) rmSync(join(outDir, entry), { recursive: true, force: true })`
  — the directory itself is never removed.
- `game/` is verified to exist, copied with `cpSync`, `screenshots/`
  copied when present, and the dossier is written with the vendored
  `buildDossier` (caps: text 160 KiB, screenshots max 4 / 256 KiB,
  game max 993 files / 48 MiB, path max 1000 bytes).
- One bug found while testing round 6: `buildDossier` returns bytes,
  so the summary line no longer `JSON.parse`s its return value; it
  counts the copied entries from the filesystem instead.

## What was built

"Marina Heat", an original open-world crime game in the fictional city
of Coral Marina (3200×3200, seeded procedural generation: street grid,
blocks, buildings with collision, palms, marina water with docks).
Vanilla JS + Canvas 2D ES modules under `game/`, no dependencies,
fully offline.

Systems: on-foot movement + sprint; mouse-aim hitscan shooting with
muzzle flash, tracers and sparks; car theft (E) and driving with
handbrake drift; vehicle damage states (dented/smoking/burning/wreck)
with smoke and fire particles; lane-following traffic AI that stops
and swerves; pedestrians that wander and flee; a 1–5 star wanted
system with heat decay out of sight and a BUSTED meter; police cruisers
that spawn, chase and ram; three missions from Marisol Vega (Bay Run,
Special Delivery, Rampage) with phone-style message popups; HUD
(health, cash, stars, chaos, car status, objective) and a live
minimap; WebAudio-synthesized SFX (shots, engine, siren, pickups,
jingles) with M mute; localStorage save with Continue on the title
screen; title / pause / WASTED / BUSTED screens and mission banners.
Deterministic screenshot mode: `?shot=<cover|drive|chase|mission>&seed=<n>`
poses a frozen scene and sets `window.__shotReady`.

## Files authored this round (fresh rewrite)

- `game/src/` — `rng.js`, `city.js`, `input.js`, `storage.js`,
  `audio.js`, `player.js`, `vehicles.js`, `traffic.js`,
  `pedestrians.js`, `police.js`, `combat.js`, `missions.js`, `hud.js`,
  `minimap.js`, `shots.js`, `main.js` (written in two parts, then the
  module wiring completed in the second pass).
- `game/index.html`, `game/style.css`
- `main.ts` (round-6 output-dir fix), `serve.ts`, `shots.json`
- `LICENSE` (MIT), `README.md`, `.makefun/owner.json`, `BUILD_NOTES.md`
- `screenshots/1-cover.jpg`, `2-drive.jpg`, `3-chase.jpg`,
  `4-mission.jpg` — captured with a Puppeteer driver serving `game/`
  locally, each JPEG ≤ 256 KiB, visually verified:
  cover = on foot at an intersection with traffic, peds, HUD, minimap
  and a phone message; drive = player driving a Coral Coupe with the
  car-status panel; chase = 3 wanted stars with police cruisers around
  the player's Vice Roadster; mission = Bay Run objective banner with
  the checkpoint ring and marker visible.
- `vendor/makefun-game.ts` untouched (kit file, byte-identical).

## Build / test results

1. Relative output: `MAKEFUN_OUTPUT_DIR=out node main.ts` → exit 0;
   `out/` contains `game/`, `screenshots/`, `dossier.json`.
2. Absolute output (grader shape): `MAKEFUN_OUTPUT_DIR=/tmp/marina-abs-out node main.ts`
   → exit 0; `/tmp/marina-abs-out` contains `game/`, `screenshots/`
   (all 4 JPEGs) and a valid `dossier.json`.
3. Browser smoke test (Puppeteer, in the screenshot driver): loaded
   the game without `?shot`, pressed Enter to start, held the mouse to
   shoot (13 shots fired), moved with WASD (player moved ~146 px),
   P paused (state `paused`) and resumed (state `playing`) — zero page
   errors, zero console errors, zero requests outside localhost.
4. Kit check: `node cli/makefun.mjs check --repo <repo> --worktree`
   → 4 passed, 0 failed, 16 skipped, 5 checked at submission.
