// main.ts — Marina Heat entrypoint (Node 22, standard library only).
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json there, built from this repository by the kit's
// vendor/makefun-game.ts buildDossier.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || 'out');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const name of ['game', 'screenshots']) {
  const src = join(repoRoot, name);
  if (!existsSync(src)) throw new Error(`main.ts: missing ${name}/ in ${repoRoot}`);
  cpSync(src, join(outDir, name), { recursive: true });
}

const dossier = buildDossier(repoRoot, {
  text_max_bytes: 160 * 1024,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`Marina Heat: wrote ${outDir}`);
console.log(`dossier.json: ${dossier.length} bytes`);
