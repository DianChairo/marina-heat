# marina-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/DianChairo/marina-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/DianChairo/marina-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Marina Heat — a top-down 2D open-world crime game set in Coral Marina, a seeded procedural 3200×3200 coastal city. Drive the boulevards, grab a car, run five jobs across the marina and the docks, dodge or outrun the police, and watch the wanted stars climb every time you pull the trigger. Vanilla JavaScript and Canvas, no libraries, no network — the whole city is generated from a seed.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — press Enter to start. WASD to move and drive, E to enter or leave a car, mouse to aim, click to shoot, Shift to run, P to pause.

## How it plays

- **Open world** — road grid, building blocks, palms, beach, marina water, docks and boats, all generated from a seed so every run with the same seed is the same city.
- **Cars** — traffic cruises the roads and parked cars wait at the kerb. Press E near one to drive it; arcade handling with acceleration, steering and collision.
- **Wanted system** — crimes raise your stars (up to 5). Police cars spawn on the roads, chase, ram, and bust you if they pin you down slow. Stay out of sight and the heat cools off.
- **Missions** — a five-job chain: drive to the marina, pick up the package, lose the heat, deliver to the docks, escape the city. Each job pays out.
- **Day cycle** — the light shifts from noon to dusk to night as you play.
- **Minimap, HUD, health, money, speed and clock** — everything on screen.

## Layout

- `game/index.html`, `game/style.css` — the page and its styles.
- `game/src/` — the game modules: `main.js` (loop), `world.js` (state), `city.js` (procedural city), `player.js`, `vehicles.js`, `police.js`, `pedestrians.js`, `combat.js`, `missions.js`, `render.js`, `hud.js`, `audio.js`, `shots.js`, `input.js`, `random.js`, `config.js`.
- `main.ts` — the make.fun program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `buildDossier` library.
- `screenshots/` — four deterministic renders of the game (cover, drive, chase, mission), taken at 1280×800.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8tpwxchz&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
