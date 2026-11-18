// Marina Heat — make.fun entrypoint (Node, standard library only).
//
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json there with the vendored buildDossier.
//
// Round-6 fix: MAKEFUN_OUTPUT_DIR may be an ABSOLUTE path (the grader
// passes /output on a read-only copy of this repo). The output path is
// therefore resolved with resolve() — never join(), which would nest an
// absolute path under the repo — and the directory's CONTENTS are
// cleared entry by entry instead of removing the directory itself,
// which the grader may have created and mounted for us.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));

const outDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(here, process.env.MAKEFUN_OUTPUT_DIR)
  : join(here, 'out');

mkdirSync(outDir, { recursive: true });
for (const entry of readdirSync(outDir)) {
  rmSync(join(outDir, entry), { recursive: true, force: true });
}

const gameDir = join(here, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error(`game/index.html is missing next to main.ts (${gameDir})`);
}
cpSync(gameDir, join(outDir, 'game'), { recursive: true });

const shotsDir = join(here, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 160 * 1024,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const gameFiles = readdirSync(join(outDir, 'game'), { recursive: true }).length;
const shotFiles = existsSync(join(outDir, 'screenshots'))
  ? readdirSync(join(outDir, 'screenshots')).length
  : 0;
console.log(
  `Marina Heat: wrote dossier.json to ${outDir} ` +
  `(game entries: ${gameFiles}, screenshots: ${shotFiles}).`,
);
