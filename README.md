# marina-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/DianChairo/marina-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/DianChairo/marina-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Marina Heat** is a top-down 2D open-world crime game set in the fictional
city of Coral Marina — a seeded 3200×3200 grid city on a beach, built with
vanilla JavaScript and Canvas 2D, no libraries. Steal cars, outrun the Coral
Marina PD, and run jobs for fixer Marisol Vega.

## Play

- **On foot:** WASD to move, Shift to sprint, mouse to aim, click to shoot.
- **Cars:** press **E** near a car to steal it, drive with WASD, Space to
  brake/drift. Damaged cars smoke, catch fire and wreck.
- **Heat:** crimes raise your 1–5 star wanted level. Police cars chase and
  ram you; get cornered while slow and the BUSTED meter fills. Lay low and
  the heat decays.
- **Jobs (press 1, 2 or 3):** Bay Run checkpoint race, Special Delivery
  pick-up and drop-off, and Rampage — score 300 points of chaos in 60
  seconds. Marisol messages you on the in-game phone.
- **World:** lane-following traffic, fleeing pedestrians, beach and marina,
  full HUD with health, money, score, wanted stars and a live minimap.
- **Audio:** synthesized WebAudio SFX (engine, siren, shots, crashes) — M
  mutes. Progress saves to localStorage; Continue on the title screen.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Build the submission output with:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Deterministic screenshot scenes: `?shot=cover|drive|chase|mission&seed=1337`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8tpwxchz&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
