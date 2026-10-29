/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

/**
 * Writes dist/sw.js after the build with the list of all built files (also those copied from
 * public/), so the app works offline after one visit. Photos are cached in the background.
 */
function serviceWorker(): Plugin {
  let outDir = '';
  return {
    name: 'hyrox-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
        .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
      const files = walk(outDir).map((f) => path.relative(outDir, f).split(path.sep).join('/')).filter((f) => !f.endsWith('.map') && f !== 'sw.js').sort();
      const shell = files.filter((f) => !f.startsWith('media/'));
      const media = files.filter((f) => f.startsWith('media/'));
      const template = fs.readFileSync(path.resolve(import.meta.dirname, 'src/sw-template.js'), 'utf8');
      const version = String(Date.now());
      fs.writeFileSync(path.join(outDir, 'sw.js'), template
        .replace('__PRECACHE__', JSON.stringify(['./', ...shell]))
        .replace('__MEDIA__', JSON.stringify(media))
        .replace('__VERSION__', version));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), serviceWorker()],
  build: { target: 'es2022', sourcemap: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
});
