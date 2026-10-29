// Copies the production build (app/dist) into the repository root. GitHub Pages publishes the
// root of main ("Deploy from a branch"), so the app goes live at https://bigbro42.github.io/Hyrox/.
// Run via `npm run release` and commit the changed root files together with the source.
import fs from 'node:fs';
import path from 'node:path';
import { releaseFiles, ROOT_DIRS } from './release-files.mjs';

const app = path.resolve(import.meta.dirname, '..');
const dist = path.join(app, 'dist');
const root = path.join(app, '..');

if (!fs.existsSync(path.join(dist, 'index.html')) || !fs.existsSync(path.join(dist, 'sw.js'))) {
  console.error('app/dist is missing or incomplete – run `npm run build` first.');
  process.exit(1);
}
// Remove what an earlier release wrote, so no stale hashed file stays online.
for (const dir of ROOT_DIRS) fs.rmSync(path.join(root, dir), { recursive: true, force: true });
const files = releaseFiles(dist);
for (const f of files) {
  fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
  fs.copyFileSync(path.join(dist, f), path.join(root, f));
}
fs.writeFileSync(path.join(root, '.nojekyll'), '');
console.log(`Released ${files.length} files to the repository root.`);
