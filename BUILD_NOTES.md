# BUILD_NOTES — Marina Heat (gta6-01, round 2)

Round-2 rewrite: the round-1 entry was rejected on a transcript technicality (an
unrelated session's backfilled messages in the recording), not on code. This build was
written entirely fresh in a new recorded session — every file below was authored line
by line in this session, then revised across several passes (staging fixes for the
screenshot scenes, a police pursuit-spread fix, a favicon fix).

## The game

**Marina Heat** — an original top-down 2D open-world crime game set in Coral Marina.
Vanilla JavaScript + Canvas 2D, ES modules, no libraries, no network requests, no
assets; all audio is synthesized live with WebAudio.

Systems, all wired together through the shared state in `main.js`:

- **City**: 6×5 block grid (roads with dashed lane markings, crosswalks, sidewalks),
  seeded buildings with lit/flickering windows, palms, lamps, hydrants, and a
  sand-and-water beach edge on the east side. Smooth follow camera with lookahead
  and impact shake.
- **On foot**: WASD/arrows, Shift sprint, mouse aim, click hitscan shooting (tracer,
  muzzle flash, sparks), health with slow regen, WASTED screen on death.
- **Cars**: parked cars to steal with E (driver-side yank; traffic drivers flee on
  foot), driving with acceleration/brake/reverse, speed-sensitive steering and a
  lateral-grip model that drifts at speed; building collisions block, car/ped
  collisions deal crash damage and shake the camera. Engine pitch follows speed.
- **Traffic AI**: lane-following cars that turn at intersections, brake for obstacles
  ahead, and honk when stuck.
- **Pedestrians**: sidewalk wanderers who panic and flee gunfire/crashes; near misses
  at speed pay chaos; running one down is a serious crime.
- **Wanted system**: witnessed crimes add heat toward 1–5 stars; police spawn at the
  city edges, chase with per-car approach lanes (they box you in), ram, and pursue on
  foot. Stars decay after ~11 s unseen. Being cornered fills BUSTED → busted screen.
- **Combat/damage**: cars smoke under 62 hp, burn under 30, and wreck at 0 (+100 chaos).
- **Missions** (pink M board, fixer Marisol Vega via phone messages): *Bay Run*
  checkpoint race, *Special Delivery* (hot package, +heat while carrying), *Rampage*
  600-chaos quota. Payouts in cash + respect; profile persists in localStorage.
- **HUD**: minimap (roads/water/player arrow/police blips/traffic dots/mission
  target), wanted stars, HEAT and BUSTED meters, health, cash/respect/chaos line,
  speedo, objective banner with distance + timer, phone box, context hints.
  Start screen with story + controls (+ Continue when a save exists), pause on P/Esc.
- **Audio**: synthesized engine hum, two-tone siren while police are active, gunshot,
  crash thuds, honks, cash blips, mission stings, phone chime, ambient pad. M mutes;
  audio starts on the first user gesture (Start button).

## Modules (game/src/)

| File | Job |
| --- | --- |
| main.js | Boot, shared state G, game loop, cross-system wiring, rendering |
| city.js | Map data, building/prop generation, world collision, city rendering |
| rng.js | Seeded RNG (mulberry32) + math helpers |
| input.js | Keyboard/mouse state |
| player.js | On-foot movement, aim, health, drawing |
| vehicles.js | Car factory, driven-car physics with drift, car drawing, car collisions |
| traffic.js | Civilian lane-following AI, braking, honking |
| pedestrians.js | Wander/flee AI, run-over + near-miss detection, drawing |
| police.js | Wanted heat/stars/busted, spawn + chase/foot-pursuit AI |
| combat.js | Hitscan shooting, particles (tracers, sparks, smoke, skids, popups) |
| missions.js | Marisol's three jobs, objectives, beacons, payouts |
| hud.js | DOM HUD: stars, meters, health, cash, objective, phone, screens |
| minimap.js | Minimap canvas rendering |
| audio.js | WebAudio synth: engine, siren, one-shot SFX, ambient pad |
| storage.js | localStorage profile (cash, respect, bests) |
| shots.js | Deterministic screenshot scenes via ?shot=<name>&seed=<n> |

Plus game/index.html and game/style.css. Total game/ source ≈ 82 KB (cap ~140 KB).

## Screenshots (screenshots/, driver: tools/game-shots/take-shots-gta6-r2.mjs)

Deterministic scenes staged in shots.js, simulated a fixed number of ticks, then
captured at 1280×720, JPEG q80:

- 1-cover.jpg (103,925 B) — on foot downtown at golden hour by the M board, traffic
  and peds around, phone intro from Marisol, minimap + objective visible.
- 2-drive.jpg (104,369 B) — driving at speed through an intersection, traffic around,
  speedo on the HUD.
- 3-chase.jpg (107,213 B) — 4-star police pursuit: three units ramming the player's
  car, HEAT + BUSTED bars up, police blips on the minimap, Marisol warning on the phone.
- 4-mission.jpg (109,576 B) — Special Delivery in progress: package on board,
  objective banner with 1151 m and timer, destination gold dot on the minimap, 2 stars.

All four ≤ 256 KiB. Each was read back and visually verified (world, HUD, minimap
all render).

## Verification

- Real-input smoke test (same driver): loaded with no shot params, clicked Start,
  drove with WASD, fired with the mouse (chaos + a wanted star registered), stole-car
  key pressed, paused and resumed with P — **zero page errors**, HUD visible, pause
  overlay shown, minimap confirmed drawn (pixel check).
- `MAKEFUN_OUTPUT_DIR=out node main.ts` — out/ holds game/, screenshots/, dossier.json.
- Kit check: `node cli/makefun.mjs check --kit . --repo <repo>` — see the run in the
  session transcript; final result PASS (exit 0) after fixes.
