// Marina Heat — round 8 (gta6-01). The game is this directory's game/
// folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request),
// and the program hands it in: it copies game/ and screenshots/ from
// beside this file to the output directory and writes dossier.json, the
// summary the judge reads, with the vendored make.fun library.
//
// ROUND 8 FIX: the dossier is produced by buildDossier from the vendored
// library — never hand-written — so it equals what the scorer rebuilds
// byte for byte (round 7 failed dossier_matches by hand-writing it).
//
// OUTPUT-DIR HARDENING (kept from round 7): the grader runs
// `node /bot/main.ts` as nobody on a READ-ONLY repo copy with an ABSOLUTE
// MAKEFUN_OUTPUT_DIR and a 10s budget, and may run it twice. So the
// output path is resolved to an absolute path, the output dir's CONTENTS
// are cleared (never the dir itself), write permission is restored on
// entries while clearing, and copied file modes are normalised to
// 755/644 (cpSync preserved read-only modes and broke repeat runs).
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, chmodSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

function normaliseModes(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      chmodSync(p, 0o755);
      normaliseModes(p);
    } else {
      chmodSync(p, 0o644);
    }
  }
}

function clearContents(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    // Restore write permission before removing, so read-only copies go away.
    try {
      chmodSync(p, st.isDirectory() ? 0o755 : 0o644);
    } catch {
      // Permission already sufficient or not ours to change; rmSync will say.
    }
    rmSync(p, { recursive: true, force: true });
  }
}

mkdirSync(out, { recursive: true });
clearContents(out);
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
normaliseModes(out);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48
// MiB of game files, in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
