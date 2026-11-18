# Marina Heat — Build Notes

## Game summary
Top-down 2D open-world crime game set in Coral Marina. Vanilla JS + Canvas 2D, ES modules, no libraries, no network. Player explores on foot or steals cars, commits crimes that raise a 1–5 star wanted level, evades police, and runs three missions for fixer Marisol Vega: Bay Run (checkpoint race), Special Delivery (package run), Rampage (chaos score). Cash + respect persist in localStorage.

## Modules (game/src/)
- main.js — boot, game loop, state machine (menu/playing/paused/wasted/busted)
- city.js — map data (grid, buildings, props, beach) + city rendering + collision helpers
- rng.js — seeded RNG (mulberry32)
- input.js — keyboard + mouse state
- player.js — on-foot player (move, aim, health, enter/exit cars)
- vehicles.js — car physics, drawing, damage states
- traffic.js — lane-following traffic AI
- pedestrians.js — wandering/fleeing pedestrians
- police.js — wanted stars, heat, busted meter, police chase AI
- combat.js — hitscan shooting, tracers, muzzle flash, damage
- missions.js — 3 missions, objectives, phone messages from Marisol Vega
- hud.js — HUD overlay (stars, health, cash, objective, phone, banners)
- minimap.js — minimap canvas rendering
- audio.js — synthesized WebAudio (engine, siren, gunshot, crash, blips, pad)
- storage.js — localStorage save/load
- shots.js — deterministic screenshot scenes (?shot=<name>&seed=<n>)

## Screenshot scenes
- 1-cover.jpg — on foot downtown golden hour, traffic + peds, HUD + minimap, mission marker
- 2-drive.jpg — driving fast mid-intersection, speed on HUD
- 3-chase.jpg — police chase, 4 stars, heat/busted visible, police blips on minimap
- 4-mission.jpg — delivery mission in progress, package carried, 2 stars

## Check results
- All 16 game modules pass `node --check`; total game/ source ≈ 70 KB (cap 160 KiB).
- Screenshot driver (tools/game-shots/take-shots-gta6.mjs): all 4 scenes rendered with zero page errors; real-input smoke test (click Start, WASD, mouse shoot, pause toggle) passed with zero page errors. Each screenshot visually verified: city, HUD, minimap, stars/objective/phone as per scene.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` → out/ holds game/, screenshots/, dossier.json; logs "Marina Heat: copied 19 game files".
- Kit check (`node cli/makefun.mjs check --kit . --repo …/gta6-01`): exit 0 — 4 passed, 0 failed, 16 skipped (transcript/site-side), 5 checked at submission.
- Screenshot sizes: 1-cover.jpg 160,661 B; 2-drive.jpg 168,710 B; 3-chase.jpg 172,881 B; 4-mission.jpg 168,651 B (all ≤ 256 KiB).

## Commit history
- 996c1a4 — starter from the make.fun gta6-01 kit (pre-existing)
- Marina Heat build commit — full game, screenshots, README, notes (see git log for sha)
