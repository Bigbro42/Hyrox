// CI check: the files in the repository root must match a fresh build of app/ (sw.js apart from
// its build version). Fails when someone changed the source but forgot `npm run release`.
import fs from 'node:fs';
import path from 'node:path';
import { releaseFiles, ROOT_DIRS } from './release-files.mjs';

const app = path.resolve(import.meta.dirname, '..');
const dist = path.join(app, 'dist');
const root = path.join(app, '..');
const read = (file) => {
  const text = fs.readFileSync(file);
  return file.endsWith('sw.js') ? text.toString('utf8').replace(/const VERSION = '[^']*'/, '') : text;
};

const built = releaseFiles(dist);
const published = ROOT_DIRS.flatMap((d) => (fs.existsSync(path.join(root, d)) ? releaseFiles(path.join(root, d)).map((f) => `${d}/${f}`) : []));
const problems = [
  ...built.filter((f) => !fs.existsSync(path.join(root, f))).map((f) => `missing in root: ${f}`),
  ...published.filter((f) => !built.includes(f)).map((f) => `outdated in root: ${f}`),
  ...built.filter((f) => fs.existsSync(path.join(root, f)) && !Buffer.from(read(path.join(dist, f))).equals(Buffer.from(read(path.join(root, f))))).map((f) => `changed: ${f}`),
];
if (problems.length) {
  console.error(`The published files are not up to date with the build – run \`npm run release\` in app/.\n${problems.slice(0, 20).join('\n')}`);
  process.exit(1);
}
console.log(`Repository root matches the build (${built.length} files).`);
