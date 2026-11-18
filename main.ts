// Marina Heat — make.fun entry packager (Node standard library only).
// Copies the playable game/ tree and the screenshots/ into the output directory and
// writes dossier.json there, built by the kit's own vendor/makefun-game.ts so the
// dossier always matches the files that were actually shipped.
import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const GAME_TITLE = 'Marina Heat';
const repoDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

function countFiles(dir: string): number {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) n += countFiles(p);
    else n++;
  }
  return n;
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(repoDir, {
  text_max_bytes: 2_000_000,
  screenshots: { max: 8, max_bytes: 256 * 1024 },
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const copied = countFiles(join(outDir, 'game')) + countFiles(join(outDir, 'screenshots'));
console.log(`${GAME_TITLE}: copied ${copied} files (game + screenshots) to ${outDir}`);
console.log(`${GAME_TITLE}: dossier.json written (${dossier.byteLength} bytes) — welcome to Coral Marina.`);
