import fs from 'node:fs';
import path from 'node:path';

/** Folders in the repository root that belong entirely to the release. */
export const ROOT_DIRS = ['assets', 'media'];

/** Published files of a build: everything except source maps. */
export function releaseFiles(dir) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  return walk(dir).map((f) => path.relative(dir, f).split(path.sep).join('/')).filter((f) => !f.endsWith('.map')).sort();
}
