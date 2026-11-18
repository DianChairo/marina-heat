// main.ts — Marina Heat entrypoint (Node stdlib only).
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json via buildDossier from the kit's vendor/makefun-game.ts.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR
  ? join(here, process.env.MAKEFUN_OUTPUT_DIR)
  : join(here, 'out');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const gameSrc = join(here, 'game');
if (!existsSync(gameSrc) || !statSync(gameSrc).isDirectory()) {
  throw new Error('game/ directory missing');
}
cpSync(gameSrc, join(outDir, 'game'), { recursive: true });

const shotsSrc = join(here, 'screenshots');
if (existsSync(shotsSrc) && statSync(shotsSrc).isDirectory()) {
  cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 160 * 1024,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const gameFiles = readdirSync(join(outDir, 'game'), { recursive: true });
const shotFiles = existsSync(join(outDir, 'screenshots'))
  ? readdirSync(join(outDir, 'screenshots'))
  : [];
console.log(`Marina Heat built into ${outDir}`);
console.log(`game files: ${gameFiles.length}, screenshots: ${shotFiles.join(', ') || 'none'}`);
console.log(`dossier.json: ${dossier.length} bytes`);
