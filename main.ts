// Neon Harbor — make.fun entry builder.
// Copies the static game and its screenshots into the output directory and
// writes the submission dossier. Node standard library only, deterministic:
// two runs over the same tree produce identical bytes.
//
// Output directory contract: the grader sets MAKEFUN_OUTPUT_DIR to a
// container MOUNT POINT and mounts this repository read-only. This program
// therefore NEVER removes the output directory (removing a mount point
// crashes), it only creates the two subdirectories and copies into them.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : (process.argv[2] ? resolve(process.argv[2]) : join(root, 'dist'));

mkdirSync(join(out, 'game'), { recursive: true });
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });

mkdirSync(join(out, 'screenshots'), { recursive: true });
const shotsDir = join(root, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

const dossierText = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossierText);

console.log('Neon Harbor built -> ' + out);
