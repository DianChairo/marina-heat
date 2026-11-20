// main.ts — make.fun program/v1 harness for Marina Heat.
//
// The grader runs `node /bot/main.ts` as user `nobody` on a READ-ONLY
// copy of this repo, with MAKEFUN_OUTPUT_DIR set to an ABSOLUTE path
// and a 10-second budget. This file therefore:
//   * resolves the output dir with path.resolve() (never joins it
//     under the repo dir),
//   * clears only the CONTENTS of the output dir, never the dir
//     itself, and creates it if missing,
//   * copies game/ and screenshots/ into it and writes dossier.json,
//   * writes nowhere else, uses no network, and exits 0 fast.
//
// It is plain JavaScript in a .ts file (Node's type stripping accepts
// it as-is) so it runs with zero dependencies and no build step.

import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || join(here, 'output'));

// Prepare the output dir: create if missing, otherwise delete its
// contents only — the directory itself must survive (the grader may
// have it mounted or pre-created). Entries copied from a read-only
// repo can themselves be read-only, so restore write permission on
// the way down before removing them.
mkdirSync(outputDir, { recursive: true });
function clearContents(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try { chmodSync(full, 0o755); } catch { /* best effort */ }
    if (statSync(full).isDirectory()) clearContents(full);
    rmSync(full, { recursive: true, force: true });
  }
}
clearContents(outputDir);

function listFiles(dir, base) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) out.push(...listFiles(full, rel));
    else out.push(rel);
  }
  return out;
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// cpSync preserves the (possibly read-only) modes of the repo copy;
// normalise the output tree so it is plainly readable.
function normaliseModes(dir) {
  chmodSync(dir, 0o755);
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) normaliseModes(full);
    else chmodSync(full, 0o644);
  }
}
normaliseModes(join(outputDir, 'game'));
if (existsSync(join(outputDir, 'screenshots'))) normaliseModes(join(outputDir, 'screenshots'));

const dossier = {
  title: 'Marina Heat',
  tagline: 'A top-down 2D open-world crime game in Coral Marina.',
  description:
    'Steal cars, run jobs for fixer Marisol Vega (deliveries, pickups and the ' +
    'timed Bay Run checkpoint race), and outrun the Coral Marina PD wanted-level ' +
    'chase system in a 3200x3200 procedurally generated coastal city with a ' +
    'street grid, palm trees, traffic, pedestrians and a marina. Vanilla ' +
    'JavaScript + Canvas 2D, no dependencies, fully offline.',
  how_to_play: 'Open game/index.html in a browser, or run `node serve.ts` and visit http://127.0.0.1:8917/.',
  controls: {
    Enter: 'Start game / confirm',
    'W A S D / Arrows': 'Move on foot, drive',
    Mouse: 'Aim',
    'Mouse button (hold)': 'Shoot',
    E: 'Enter / exit the nearest car',
    Shift: 'Sprint on foot',
    P: 'Pause / resume',
    M: 'Toggle sound',
  },
  features: [
    'Seeded procedural city: 3200x3200, street grid, varied buildings, palms, marina with docks and boats',
    'Car stealing and arcade driving with damage',
    'Five-star wanted system: police cruisers pursue, ram and shoot; officers bust you on foot',
    'Living traffic that follows the grid and pedestrians that flee violence',
    'Missions for fixer Marisol Vega, including the Bay Run checkpoint race',
    'HUD with cash/reputation/health/wanted stars and a live minimap',
    'WebAudio synth: engine, sirens, gunshots, pickups — no audio files',
    'localStorage save game',
    'Deterministic screenshot modes via ?shot=cover|drive|chase|mission&seed=7',
  ],
  seed: 7,
  world: { size: 3200, water: 'east and south edges', generator: 'game/src/city.js (mulberry32 seeded RNG)' },
  files: {
    game: listFiles(gameDir, 'game'),
    screenshots: existsSync(shotsDir) ? listFiles(shotsDir, 'screenshots') : [],
  },
  tech: 'Vanilla JS ES modules + Canvas 2D. No dependencies, no build step.',
};

writeFileSync(join(outputDir, 'dossier.json'), JSON.stringify(dossier, null, 2) + '\n', 'utf8');

console.log(`Marina Heat: wrote game/, screenshots/ and dossier.json to ${outputDir}`);
