# BUILD_NOTES — Marina Heat (gta6-01), round 4

## What this is
Top-down 2D open-world crime game "Marina Heat", set in the fictional city
Coral Marina. Vanilla JS + Canvas 2D, ES modules, no libraries. Node stdlib
only for main.ts. Built fresh in round 4 (recording 01a1ec81-6f3b-7189-bd79-ce5a9e4c468d):
all round-3 game files were deleted first, then every file below was written
fresh in this session with the agent's own write/edit calls — no old game
file was read and retyped, no file was copied in via shell.

## Files (game/)
- `index.html` + `style.css` — canvas, HUD DOM, minimap canvas, title / pause /
  WASTED / BUSTED screens.
- `src/rng.js` — mulberry32 + FNV hash, seeded RNG used by everything.
- `src/city.js` — seeded 3200x3200 grid city: ocean + beach west, road grid,
  building blocks, parks, marina pier, fixer spot; collision + road helpers.
- `src/input.js` — keyboard/mouse state, edge-triggered presses, WASD vector.
- `src/audio.js` — synthesized WebAudio SFX (engine, siren, shots, crash,
  cash, phone); mute toggle; no audio files.
- `src/storage.js` — localStorage save/load (money, score, missions, position).
- `src/player.js` — on-foot movement, sprint, mouse aim, health, car theft (E).
- `src/vehicles.js` — arcade car physics, drift, damage smoke/fire/wreck,
  car-car separation, particles.
- `src/traffic.js` — lane-following AI cars, intersection turns, recycling.
- `src/pedestrians.js` — sidewalk walkers, flee/panic, cash drops, pickups.
- `src/police.js` — 1–5 star wanted system, heat decay, police chase/ram,
  BUSTED meter, foot cops.
- `src/combat.js` — mouse-aim hitscan shooting, tracers, ray vs circle/rect.
- `src/missions.js` — 3 jobs for fixer Marisol Vega (Bay Run checkpoint race,
  Special Delivery, Rampage score) + phone-message thread.
- `src/hud.js` — health bar, cash/score, wanted stars, mission box, messages.
- `src/minimap.js` — corner map: roads, buildings, beach, player/police/
  traffic/objective dots, viewport rect.
- `src/shots.js` — deterministic `?shot=cover|drive|chase|mission&seed=n`
  scenes; sets `window.__shotReady` after 5 rendered frames.
- `src/main.js` — entrypoint: world build, game loop, camera, screens,
  autosave, shot-mode settle + freeze.

## Entry plumbing (repo root)
- `main.ts` — Node stdlib only; copies game/ + screenshots/ to
  `$MAKEFUN_OUTPUT_DIR` (default `out`) and writes `dossier.json` via
  `buildDossier` from `vendor/makefun-game.ts` (caps: text 160 KiB,
  screenshots max 4 x 256 KiB, game max 993 files / 48 MiB).
- `serve.ts` — kit starter server, unchanged; serves game/ on :8080.
- `shots.json` — 4 shots, all `seed=7`.
- `screenshots/` — 4 JPEGs, 1280x720, ~79–86 KiB each, real Chrome renders.

## Fixes found by testing in this round
1. Title screen overlayed all screenshots: shot mode never hid it.
   Fixed in main.js — `showScreen(hud, null)` after `applyShot`.
2. Stealing a car instantly bailed out again: the same E keypress was read
   by both `updatePlayer` (steal) and `updatePlayerCar` (bail) in one frame.
   Fixed in player.js — the steal consumes the press
   (`input.pressed.delete('KeyE')`).
3. Favicon 404 console errors: added `<link rel="icon" href="data:,">`.
4. Police ram damage was frame-scaled wrong (`14 * dt * 10`); corrected to
   per-second rates in police.js.

## Verification (round 4, this session)
- All 16 game modules parse (vm.SourceTextModule): OK.
- Screenshots: `take-shots-gta6-r4.mjs` (fresh driver, Chrome for Testing
  157.0.8103.50), 4/4 saved; visually inspected — cover on foot by Marisol,
  drive in traffic, 3-star chase with police + dispatch message, Bay Run
  checkpoint ring + mission HUD.
- Smoke test: `smoke-gta6-r4.mjs` — Start click, WASD moves player
  (480,480 → 623,340), mouse shooting (wanted 1, heat 12, tracer drawn),
  E steals car, driving speed 245, P pause / resume, Digit1 starts Bay Run.
  Zero page errors.
- Output build: `MAKEFUN_OUTPUT_DIR=out node main.ts` — dossier.json
  520,372 bytes, text 74,643 bytes (under the 160 KiB cap), 4 images.
- Kit check: `node cli/makefun.mjs check --kit . --repo <repo>` — 4 passed,
  0 failed, 16 skipped (transcript checks run site-side), 5 checked at
  submission (repo public / owner / created-after-open / commit-in-repo /
  duplicate — resolved at submit; repo is DianChairo/marina-heat,
  .makefun/owner.json present).

## Known cosmetic notes
- Mission shot compass text ("318m") overlaps the controls hint at the
  bottom-left corner; harmless.
- A police car in the chase shot clipped a building corner during the
  settle steps; reads as chase chaos.
